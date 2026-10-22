# Lånndet — rolka na Facebooka

[Pobierz film MP4](https://github.com/RobertCygan/laandet/raw/refs/heads/main/promo/Laanndet-10s.mp4)

Gotowy film ma dokładnie 10 sekund, format pionowy 9:16, rozdzielczość 1080 × 1920 i 30 klatek na sekundę. MP4 zawiera obraz H.264 oraz dźwięk AAC stereo 48 kHz. Można dodać go jako rolkę na Facebooku lub Instagramie. Napisy są po norwesku i pozostają czytelne bez dźwięku. `Laanndet-cover.jpg` jest opcjonalną okładką.

Film wykorzystuje rzeczywiste widoki przesłanego pliku HTML, osadzone w nim przykładowe zdjęcia, kolory projektu, font Manrope i logo G-PSI dostarczone przez właściciela. Oznaczenie „Konseptdemo · Eksempelannonser” jest widoczne przez cały film. Końcowe pytanie „Ville du brukt det?” zaprasza do opinii o pomyśle dla Steigen. Podkład instrumentalny został wygenerowany w skrypcie, bez zewnętrznych nagrań ani sampli.

Montaż:

- 0–2,35 s: „Trenger du noe bare én gang?”
- 2,35–5,15 s: „Finn det du trenger. Rett i nærheten.”
- 5,15–7,30 s: „Lei ut det du allerede har.”
- 7,30–10 s: Lånndet, Steigen i pytanie „Ville du brukt det?”

Odtworzenie wymaga zależności npm projektu, Chrome/Chromium i FFmpeg:

```sh
node scripts/render-reel.mjs --input Laanndet.html
```

Opcja `--preview` generuje wyłącznie kadry i planszę podglądu w ignorowanym katalogu `out/reel/`. Źródło kompozycji to `scripts/reel-canvas.html`. Zrzuty powstają offline, a film nie zawiera lokalnych danych uczestników ankiet.
