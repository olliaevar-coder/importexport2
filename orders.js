const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');

const ROUTES = {
  boat: { label: 'Boat', legs: ['boat'] }, train: { label: 'Train', legs: ['train'] },
  plane: { label: 'Plane', legs: ['plane'] }, boat_plane: { label: 'Boat → Plane', legs: ['boat', 'plane'] },
  train_plane: { label: 'Train → Plane', legs: ['train', 'plane'] },
  boat_train: { label: 'Boat → Train', legs: ['boat', 'train'] },
  boat_train_plane: { label: 'Boat → Train → Plane', legs: ['boat', 'train', 'plane'] }
};
const LEG_DATA = {
  boat: { tariff: 30000, fee: 25000, eta: [45, 60], feeUnit: 'Theo' },
  train: { tariff: 50000, fee: 40000, eta: [25, 40], feeUnit: 'Theo' },
  plane: { tariff: 70000, fee: 50000, eta: [10, 20], feeUnit: 'MJ' }
};
const money = (n) => `${Number(n || 0).toLocaleString()} credits`;
const titleCase = (text) => text.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
function calculateRoute(route, priority) {
  const info = ROUTES[route];
  if (!info) throw new Error('Unknown route');
  let tariff = 0, companyFee = 0, low = 0, high = 0;
  for (const leg of info.legs) { const d = LEG_DATA[leg]; tariff += d.tariff; companyFee += d.fee; low += d.eta[0]; high += d.eta[1]; }
  if (priority) { tariff += 15000; low = Math.ceil(low * .75); high = Math.ceil(high * .75); }
  return { tariff, companyFee, total: tariff + companyFee, etaLow: low, etaHigh: high };
}
function routeOptions() { return Object.entries(ROUTES).map(([value, data]) => ({ label: data.label, value })); }
function customerEmbed(order) {
  const route = order.selected_route ? ROUTES[order.selected_route].label : 'Awaiting staff route selection';
  const preference = order.preference === 'cheapest' ? 'Cheapest suitable route' : `Use my selected route (${ROUTES[order.requested_route]?.label || 'not set'})`;
  const e = new EmbedBuilder().setColor(order.status === 'completed' ? 0x57f287 : 0x5865f2)
    .setTitle(`Order #${order.id}`)
    .setDescription('Your import/export request has been submitted.')
    .addFields(
      { name: 'Scope / cargo', value: `${order.domestic ? 'Domestic' : 'International'} • ${order.cargo_type}`, inline: false },
      { name: 'Route preference', value: preference, inline: false },
      { name: 'Status', value: titleCase(order.status), inline: true },
      { name: 'Priority', value: order.priority ? 'Yes' : 'No', inline: true },
      { name: 'Route', value: route, inline: true }
    ).setTimestamp(new Date(order.created_at));
  if (order.selected_route) e.addFields(
    { name: 'Government tariff', value: money(order.tariff), inline: true },
    { name: 'Company fee', value: money(order.company_fee), inline: true },
    { name: 'Total', value: money(order.total), inline: true },
    { name: 'Estimated transit time', value: `${order.eta_low}–${order.eta_high} days`, inline: true },
    { name: 'Payment', value: order.paid ? 'Paid' : 'Unpaid', inline: true }
  );
  return e;
}
function staffEmbed(order) {
  const e = customerEmbed(order).setTitle(`Staff: Order #${order.id}`).setColor(0xfee75c)
    .addFields({ name: 'Customer', value: `<@${order.customer_id}> (${order.customer_tag})`, inline: false },
      { name: 'Pickup', value: order.pickup, inline: true }, { name: 'Destination', value: order.destination, inline: true });
  if (order.preference === 'cheapest') e.setFooter({ text: 'Cheapest requested: choose the lowest suitable valid route; location/logistics mapping is a staff decision.' });
  return e;
}
function staffComponents(order) {
  const disabled = order.status === 'completed';
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`o:route:${order.id}`).setLabel('Select route').setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`o:paid:${order.id}`).setLabel(order.paid ? 'Paid ✓' : 'Mark paid').setStyle(ButtonStyle.Success).setDisabled(disabled || !!order.paid),
    new ButtonBuilder().setCustomId(`o:transit:${order.id}`).setLabel('In transit').setStyle(ButtonStyle.Secondary).setDisabled(disabled || !order.selected_route),
    new ButtonBuilder().setCustomId(`o:completed:${order.id}`).setLabel('Complete').setStyle(ButtonStyle.Success).setDisabled(disabled || order.status !== 'in_transit')
  )];
}
function selectRow(customId, placeholder) { return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).addOptions(routeOptions())); }
function textModal(customId, title, fieldId, label, placeholder) {
  return new ModalBuilder().setCustomId(customId).setTitle(title).addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(fieldId).setLabel(label).setPlaceholder(placeholder).setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)));
}
module.exports = { ROUTES, calculateRoute, customerEmbed, staffEmbed, staffComponents, selectRow, textModal };
