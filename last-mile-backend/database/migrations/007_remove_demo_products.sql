DELETE FROM products
WHERE merchant_id IN (3, 4)
  AND name IN (
    'Air Force 1 Ultra',
    'iPhone 13 Pro Max',
    'Casque Bluetooth Studio',
    'Montre Connectee Active',
    'Sac a Main Cuir Urbain',
    'Lunettes Polarisees Nova',
    'Parfum Signature 100 ml',
    'Veste Streetwear Premium'
  );
