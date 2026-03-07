#!/usr/bin/env node
/**
 * Generate VAPID keys for Web Push notifications.
 * Run: node scripts/generate-vapid-keys.mjs
 * Add the output to your .env file.
 */
import webpush from "web-push"

const { publicKey, privateKey } = webpush.generateVAPIDKeys()
console.log("\nAdd these to your .env file:\n")
console.log("VAPID_PUBLIC_KEY=\"" + publicKey + "\"")
console.log("VAPID_PRIVATE_KEY=\"" + privateKey + "\"")
console.log("NEXT_PUBLIC_VAPID_PUBLIC_KEY=\"" + publicKey + "\"")
console.log("")
