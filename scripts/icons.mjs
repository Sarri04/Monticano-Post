import sharp from 'sharp';
for (const s of [192, 512]) await sharp('public/icon.svg').resize(s, s).png().toFile(`public/icon-${s}.png`);
await sharp('public/icon.svg').resize(180, 180).png().toFile('public/apple-touch-icon.png');
