import type { Firestore } from 'firebase/firestore';
import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore';

/**
 * Remove o app e todas as subcoleções conhecidas: screens → hotspots, issues.
 * As imagens (imageUrl em base64) somem com o documento da tela.
 */
export async function deleteAppCascade(db: Firestore, appId: string): Promise<void> {
  const screensSnap = await getDocs(collection(db, `apps/${appId}/screens`));
  for (const screenDoc of screensSnap.docs) {
    const hotspotsSnap = await getDocs(
      collection(db, `apps/${appId}/screens/${screenDoc.id}/hotspots`)
    );
    await Promise.all(hotspotsSnap.docs.map((d) => deleteDoc(d.ref)));
    await deleteDoc(screenDoc.ref);
  }

  const issuesSnap = await getDocs(collection(db, `apps/${appId}/issues`));
  await Promise.all(issuesSnap.docs.map((d) => deleteDoc(d.ref)));

  await deleteDoc(doc(db, 'apps', appId));
}
