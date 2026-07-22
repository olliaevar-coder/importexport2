require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
for (const key of ['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID']) if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
const commands = [new SlashCommandBuilder().setName('order').setDescription('Start a new import/export order').toJSON()];
(async () => {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
  console.log(`Registered ${commands.length} guild command(s) to ${process.env.GUILD_ID}.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
