#!/usr/bin/env node
/**
 * Génère une paire de clés VAPID pour les notifications Web Push.
 * Usage : npm run push:vapid
 * Puis renseigner VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY dans .env
 */
const webpush = require("web-push");

const keys = webpush.generateVAPIDKeys();
console.log("Clés VAPID générées — à copier dans .env :\n");
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}\n`);
