// Asks for a folder of music (or some songs) with the browser's own file dialog; resolves to the files picked, or none if it was cancelled.
// The browser only lets a page do this from a click or a key press, which the panel button and the console command both are.

export function pickMusicFiles() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'audio/*,.mp3,.wav,.flac,.m4a,.ogg';
    input.webkitdirectory = true; // a folder; most browsers also let you pick files in it
    input.style.display = 'none';
    const done = (files) => {
      input.remove();
      resolve(files);
    };
    input.addEventListener('change', () => done([...input.files]));
    input.addEventListener('cancel', () => done([]));
    document.body.appendChild(input);
    input.click();
  });
}
