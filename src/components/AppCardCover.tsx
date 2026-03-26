import React, { useState, useEffect } from 'react';
import { db, collection, query, orderBy, limit, onSnapshot } from '../firebase';
import constructionAppImage from '../assets/images/construction_app.png';

interface AppCardCoverProps {
  appId: string;
  alt: string;
  className?: string;
}

/**
 * Capa do card no dashboard: imagem padrão até existir a primeira tela (menor `order`);
 * então usa o `imageUrl` dessa tela.
 */
export default function AppCardCover({ appId, alt, className }: AppCardCoverProps) {
  const [src, setSrc] = useState<string>(constructionAppImage);

  useEffect(() => {
    const q = query(
      collection(db, `apps/${appId}/screens`),
      orderBy('order', 'asc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docSnap = snapshot.docs[0];
        const imageUrl = docSnap?.get('imageUrl') as string | undefined;
        setSrc(imageUrl && imageUrl.length > 0 ? imageUrl : constructionAppImage);
      },
      () => {
        setSrc(constructionAppImage);
      }
    );

    return () => unsubscribe();
  }, [appId]);

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
    />
  );
}
