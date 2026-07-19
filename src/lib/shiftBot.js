// Compte "système" utilisé pour envoyer des messages privés automatiques
// (ex: notification de bannissement/débannissement), au nom de "Shift".
//
// Ce n'est PAS un vrai compte utilisateur (personne ne peut se connecter
// avec) : c'est juste un identifiant fixe, au format UUID valide (pour que
// Supabase l'accepte dans les colonnes de type uuid / uuid[]), utilisé comme
// sender_id des messages et comme "participant" fictif des conversations
// privées générées automatiquement.
//
// ⚠️ Si la table "messages" a une policy RLS du style
//     WITH CHECK (sender_id = auth.uid())
// alors ces envois échoueront pour tout le monde SAUF si cette policy est
// assouplie côté Supabase pour autoriser explicitement SHIFT_BOT_ID, par ex :
//     WITH CHECK (sender_id = auth.uid() OR sender_id = '00000000-0000-0000-0000-000000000001')
// De même pour "dm_conversations" si une policy restreint les participants
// insérables. On ne peut pas vérifier ça depuis le code : à adapter côté
// Supabase si les envois échouent silencieusement (regarder la console).

import { db } from "@/lib/localDb";
import shiftLogo from "@/assets/shift.ico";
import moment from "moment";
import "moment/locale/fr";
moment.locale("fr");

export const SHIFT_BOT_ID = "00000000-0000-0000-0000-000000000001";
export const SHIFT_BOT_NAME = "Shift";
export const SHIFT_BOT_AVATAR = shiftLogo;

// Retrouve (ou crée) la conversation privée 1:1 entre SHIFT_BOT_ID et
// l'utilisateur ciblé, puis y ajoute un message système.
// N'échoue jamais bruyamment : une erreur ici (RLS, réseau, etc.) est juste
// logguée en console, elle ne doit jamais casser le flux de /ban ou /unban
// qui a déjà eu lieu à ce stade.
export async function sendShiftSystemMessage(targetUserId, targetUserName, content) {
  if (!targetUserId || !content) return;
  try {
    const existing = await db.entities.DMConversation.filter({});
    let conv = existing.find(
      (c) =>
        (c.participants?.length || 0) === 2 &&
        c.participants?.includes(targetUserId) &&
        c.participants?.includes(SHIFT_BOT_ID)
    );
    if (!conv) {
      conv = await db.entities.DMConversation.create({
        participants: [targetUserId, SHIFT_BOT_ID],
        participant_names: [targetUserName || "Utilisateur", SHIFT_BOT_NAME]
      });
    }

    await db.entities.Message.create({
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      dm_conversation_id: conv.id,
      sender_id: SHIFT_BOT_ID,
      sender_name: SHIFT_BOT_NAME,
      sender_avatar: SHIFT_BOT_AVATAR,
      content,
      type: "dm",
      created_date: new Date().toISOString()
    });
  } catch (err) {
    console.error("shiftBot: échec de l'envoi du message système", err);
  }
}

// Formate la date d'expiration façon "30 sec / 2 min / 5h" etc. pour un
// message court et lisible dans la notif (moment est déjà utilisé ailleurs
// dans l'app pour le français).
export function formatExpiresAt(expiresAt) {
  return moment(expiresAt).format("DD MMM YYYY, HH:mm");
}
