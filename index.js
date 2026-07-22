require('dotenv').config();
const { Client, Events, GatewayIntentBits, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createOrder, getOrder, updateOrder } = require('./src/database');
const { ROUTES, calculateRoute, customerEmbed, staffEmbed, staffComponents, selectRow, textModal } = require('./src/orders');

for (const key of ['DISCORD_TOKEN', 'STAFF_CHANNEL_ID']) if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const drafts = new Map();
const routes = Object.entries(ROUTES).map(([value, route]) => ({ label: route.label, value }));
const draftFor = (userId) => drafts.get(userId);
function startDraft(user) { const d = { customer_id: user.id, customer_tag: user.tag }; drafts.set(user.id, d); return d; }
function requireDraft(interaction) { const d = draftFor(interaction.user.id); if (!d) { interaction.reply({ content: 'This order session expired. Run `/order` again.', ephemeral: true }); return null; } return d; }
function domesticRow() { return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('o:new:scope').setPlaceholder('Domestic or international?').addOptions([{ label: 'Domestic', value: 'domestic' }, { label: 'International', value: 'international' }])); }
function cargoRow() { return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('o:new:cargo').setPlaceholder('Choose cargo type').addOptions([{ label: 'General cargo', value: 'General cargo' }, { label: 'Containerized goods', value: 'Containerized goods' }, { label: 'Perishable goods', value: 'Perishable goods' }, { label: 'Oversized / project cargo', value: 'Oversized / project cargo' }, { label: 'Hazardous goods', value: 'Hazardous goods' }])); }
function preferenceRow() { return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('o:new:preference').setPlaceholder('Choose a route preference').addOptions([{ label: 'Cheapest suitable route', value: 'cheapest', description: 'Staff determines the lowest suitable route' }, { label: 'Use my route choice', value: 'customer_route', description: 'You select one of the listed valid routes' }])); }
function priorityRow() { return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('o:new:priority').setPlaceholder('Is this priority shipping?').addOptions([{ label: 'No', value: 'no' }, { label: 'Yes (+15,000 tariff; 25% faster ETA)', value: 'yes' }])); }
function pickupButton() { return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('o:new:pickup').setLabel('Enter pickup location').setStyle(ButtonStyle.Primary))]; }
function destinationButton() { return [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('o:new:destination').setLabel('Enter destination').setStyle(ButtonStyle.Primary))]; }
function isStaff(interaction) {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return true;
  const allowed = (process.env.STAFF_ROLE_IDS || '').split(',').map(x => x.trim()).filter(Boolean);
  return allowed.length > 0 && allowed.some(id => interaction.member?.roles?.cache?.has(id));
}
async function refreshOrderMessages(order) {
  const updates = [];
  if (order.customer_channel_id && order.customer_message_id) updates.push((async () => { try { const channel = await client.channels.fetch(order.customer_channel_id); const message = await channel.messages.fetch(order.customer_message_id); await message.edit({ embeds: [customerEmbed(order)], components: [] }); } catch (error) { console.warn(`Could not update customer order #${order.id}:`, error.message); } })());
  if (order.staff_channel_id && order.staff_message_id) updates.push((async () => { try { const channel = await client.channels.fetch(order.staff_channel_id); const message = await channel.messages.fetch(order.staff_message_id); await message.edit({ embeds: [staffEmbed(order)], components: staffComponents(order) }); } catch (error) { console.warn(`Could not update staff order #${order.id}:`, error.message); } })());
  await Promise.all(updates);
}
async function submitOrder(interaction, draft) {
  const order = createOrder({ ...draft, guild_id: interaction.guildId, domestic: draft.domestic ? 1 : 0, priority: draft.priority ? 1 : 0, requested_route: draft.requested_route || null });
  await interaction.update({ content: 'Order submitted. Staff will review it here.', embeds: [customerEmbed(order)], components: [] });
  const customerMessage = await interaction.fetchReply();
  let stored = updateOrder(order.id, { customer_channel_id: customerMessage.channelId, customer_message_id: customerMessage.id });
  const staffChannel = await client.channels.fetch(process.env.STAFF_CHANNEL_ID);
  if (!staffChannel?.isTextBased()) throw new Error('STAFF_CHANNEL_ID must point to a text-based channel.');
  const staffMessage = await staffChannel.send({ embeds: [staffEmbed(stored)], components: staffComponents(stored) });
  updateOrder(order.id, { staff_channel_id: staffMessage.channelId, staff_message_id: staffMessage.id });
  drafts.delete(interaction.user.id);
}
client.once(Events.ClientReady, ready => console.log(`Logged in as ${ready.user.tag}`));
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'order') {
      startDraft(interaction.user);
      return interaction.reply({ content: 'Step 1 of 7 — choose shipment scope.', components: [domesticRow()] });
    }
    if (interaction.isModalSubmit()) {
      const draft = requireDraft(interaction); if (!draft) return;
      if (interaction.customId === 'o:new:pickup-modal') { draft.pickup = interaction.fields.getTextInputValue('pickup'); return interaction.update({ content: 'Step 4 of 7 — enter the destination.', components: destinationButton() }); }
      if (interaction.customId === 'o:new:destination-modal') { draft.destination = interaction.fields.getTextInputValue('destination'); return interaction.update({ content: 'Step 5 of 7 — choose route preference.', components: [preferenceRow()] }); }
      return;
    }
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith('o:staff-route:')) {
        if (!isStaff(interaction)) return interaction.reply({ content: 'Staff permission is required.', ephemeral: true });
        const id = Number(interaction.customId.split(':')[2]); const route = interaction.values[0]; const order = getOrder(id);
        if (!order || !ROUTES[route]) return interaction.reply({ content: 'Order or route no longer exists.', ephemeral: true });
        const c = calculateRoute(route, !!order.priority);
        const changed = updateOrder(id, { selected_route: route, tariff: c.tariff, company_fee: c.companyFee, total: c.total, eta_low: c.etaLow, eta_high: c.etaHigh, status: 'route_selected' });
        await interaction.update({ embeds: [staffEmbed(changed)], components: staffComponents(changed) });
        return refreshOrderMessages(changed);
      }
      const draft = requireDraft(interaction); if (!draft) return;
      const value = interaction.values[0];
      if (interaction.customId === 'o:new:scope') { draft.domestic = value === 'domestic'; return interaction.update({ content: 'Step 2 of 7 — choose cargo type.', components: [cargoRow()] }); }
      if (interaction.customId === 'o:new:cargo') { draft.cargo_type = value; return interaction.update({ content: 'Step 3 of 7 — enter pickup location.', components: pickupButton() }); }
      if (interaction.customId === 'o:new:preference') { draft.preference = value; if (value === 'customer_route') return interaction.update({ content: 'Step 6 of 7 — select your valid route option.', components: [selectRow('o:new:customer-route', 'Select your route')] }); return interaction.update({ content: 'Step 6 of 7 — is this priority shipping?', components: [priorityRow()] }); }
      if (interaction.customId === 'o:new:customer-route') { draft.requested_route = value; return interaction.update({ content: 'Step 6 of 7 — is this priority shipping?', components: [priorityRow()] }); }
      if (interaction.customId === 'o:new:priority') { draft.priority = value === 'yes'; return submitOrder(interaction, draft); }
    }
    if (interaction.isButton()) {
      if (interaction.customId === 'o:new:pickup') { if (!requireDraft(interaction)) return; return interaction.showModal(textModal('o:new:pickup-modal', 'Pickup location', 'pickup', 'Pickup location', 'City, port, address, and relevant notes')); }
      if (interaction.customId === 'o:new:destination') { if (!requireDraft(interaction)) return; return interaction.showModal(textModal('o:new:destination-modal', 'Destination', 'destination', 'Destination location', 'City, port, address, and relevant notes')); }
      const [, action, rawId] = interaction.customId.split(':'); const id = Number(rawId);
      if (!id || !isStaff(interaction)) return interaction.reply({ content: 'Staff permission is required.', ephemeral: true });
      const order = getOrder(id); if (!order) return interaction.reply({ content: 'Order not found.', ephemeral: true });
      if (action === 'route') return interaction.update({ content: 'Choose a route. For “cheapest”, select the lowest suitable option based on your logistics judgement.', embeds: [staffEmbed(order)], components: [selectRow(`o:staff-route:${id}`, 'Select staff route')] });
      if (action === 'paid') { const changed = updateOrder(id, { paid: 1 }); await interaction.update({ embeds: [staffEmbed(changed)], components: staffComponents(changed) }); return refreshOrderMessages(changed); }
      if (action === 'transit') { const changed = updateOrder(id, { status: 'in_transit' }); await interaction.update({ embeds: [staffEmbed(changed)], components: staffComponents(changed) }); return refreshOrderMessages(changed); }
      if (action === 'completed') { const changed = updateOrder(id, { status: 'completed' }); await interaction.update({ embeds: [staffEmbed(changed)], components: staffComponents(changed) }); return refreshOrderMessages(changed); }
    }
  } catch (error) {
    console.error('Interaction error:', error);
    const reply = { content: 'Something went wrong processing this order. Please try again or contact staff.', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(reply).catch(() => {}); else await interaction.reply(reply).catch(() => {});
  }
});
client.login(process.env.DISCORD_TOKEN);
