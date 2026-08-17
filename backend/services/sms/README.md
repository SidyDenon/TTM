# Fournisseurs SMS

Le backend appelle uniquement `sendSMS(to, message)` depuis `services/sms/index.js`.
Le fournisseur actif est choisi avec `SMS_PROVIDER`.

## Africa's Talking

```env
SMS_PROVIDER=africastalking
AFRICAS_TALKING_USERNAME=...
AFRICAS_TALKING_API_KEY=...
AFRICAS_TALKING_SENDER_ID=...
```

## Ajouter un fournisseur

1. Créer `providers/nom.js` et exporter `async function send({ to, message })`.
2. Valider dans cet adaptateur la réponse réelle du fournisseur et lever une erreur en cas de refus.
3. Ajouter son chargeur dans l'objet `providers` de `index.js`.
4. Définir `SMS_PROVIDER=nom` et les identifiants correspondants.

Les routes OTP ne doivent pas être modifiées lors d'un changement de fournisseur.
