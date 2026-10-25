// What the girls say when you raise the camera (photos/photos.js): posing, pulling a face, putting it away, and looking at the wall afterwards.
// Merged into the main line sets (voiceLines.js, jessLines.js), so they're recorded with the rest.

const line = (cooldown, lines) => ({ cooldown, lines });

export const AMY_PHOTO_LINES = {
  photoPose: line(20, ['Go on, then. Make it a good one.', 'Is my hair all right? Never mind.', 'Quickly, before I think better of it.']),
  photoFace: line(20, ['Oh, all right.', 'This is a silly one. Do not pin it up.']),
  photoPutAway: line(20, ['Put that away.', 'Not now. I have mud on my face.', 'No photographs. I mean it.']),
  photoWall: line(90, ['That one is going on the board, is it?', 'There is a photograph of us on the cork board.']),
};

export const JESS_PHOTO_LINES = {
  photoPose: ['Get my good side!', 'Ooh, photo! Hang on.', 'Take it, take it, I am gorgeous.'],
  photoFace: ['Tongue out, ready? Go!', 'This one is going straight on the wall.', 'Make it a funny one!'],
  photoPutAway: ['Not me! Take one of Amy.', 'Oi, no! I look a state.'],
  photoWall: ['Look, we are on the cork board!', 'That is my best photo on the wall.'],
};
