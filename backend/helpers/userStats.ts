import admin from 'firebase-admin';

const db = admin.firestore();

export async function recalcAndUpdateUserTotalPower(userId: string): Promise<number> {
  // Sumariza power dos userItems do usuário e atualiza campo users.totalPower
  const userItemsSnap = await db.collection('userItems').where('userId', '==', userId).get();
  if (userItemsSnap.empty) {
    await db.collection('users').doc(userId).set({ totalPower: 0 }, { merge: true });
    return 0;
  }

  const itemIds = new Set<string>();
  const userItemData: Array<{ itemId?: string; quantity?: number }> = [];
  for (const doc of userItemsSnap.docs) {
    const d = doc.data();
    userItemData.push(d);
    if (d.itemId) itemIds.add(d.itemId);
    if (d.item && d.item.id) itemIds.add(d.item.id);
  }

  const ids = Array.from(itemIds);
  const itemsById = new Map<string, any>();
  if (ids.length > 0) {
    const refs = ids.map(id => db.collection('items').doc(id));
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (!snap.exists) continue;
      itemsById.set(snap.id, snap.data());
    }
  }

  let totalPower = 0;
  for (const ui of userItemData) {
    const qty = ui.quantity || 1;
    let item = ui.item;
    if (!item && ui.itemId && itemsById.has(ui.itemId)) {
      item = itemsById.get(ui.itemId);
    }
    const power = (item && (item.power || 0)) || 0;
    totalPower += power * qty;
  }

  await db.collection('users').doc(userId).set({ totalPower }, { merge: true });
  return totalPower;
}