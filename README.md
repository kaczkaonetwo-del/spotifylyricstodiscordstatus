# 🎵 Spotify to Discord Synced Lyrics Status

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-v18+-green?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js version">
  <img src="https://img.shields.io/badge/Windows-10%20%2F%2011-blue?style=for-the-badge&logo=windows&logoColor=white" alt="Windows Compatibility">
  <img src="https://img.shields.io/badge/Discord-Custom%20Status-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord Status">
  <img src="https://img.shields.io/badge/Dependencies-Zero%20%2F%20Native-orange?style=for-the-badge&logo=javascript&logoColor=white" alt="Dependencies">
</p>

Automatyczny program w **Node.js**, który śledzi aktualnie odtwarzaną muzykę w aplikacji **Spotify na systemie Windows** i ustawia Twój status na Discordzie na **dokładną linijkę (wers) piosenki, który w danej chwili śpiewa artysta**. Całość zsynchronizowana jest w czasie rzeczywistym i sterowana z poziomu przepięknego panelu kontrolnego w przeglądarce!

---

## ✨ Główne cechy programu

*   **🔌 Zero konfiguracji Spotify API**: Nie musisz zakładać konta deweloperskiego Spotify ani przechodzić przez logowanie OAuth. Program korzysta z systemowych interfejsów **Windows Media Control (WinRT / UWP)**, by natychmiastowo pobierać pozycję utworu bezpośrednio z systemu.
*   **⚡ Zero zewnętrznych pakietów (Zero Dependencies)**: Serwer Node.js został napisany w całości w natywnym kodzie. Nie musisz instalować setek megabajtów w folderze `node_modules` – program uruchamia się natychmiastowo!
*   **🎤 Synchronizacja tekstu w czasie rzeczywistym**: Aplikacja pobiera zsynchronizowane teksty piosenek z darmowego i otwartego API **LRCLIB**.
*   **🎨 Premium Glassmorphic Dashboard**: Nowoczesny panel sterowania w przeglądarce pod adresem `http://localhost:3000` wykonany w ciemnym motywie ze szklanymi kartami, neonowymi poświatami oraz animowaną wizualizacją fal dźwiękowych.
*   **📱 Panel Karaoke**: Podgląd całego tekstu piosenki, gdzie aktywny wers powiększa się, podświetla na zielono i automatycznie centruje, przewijając się w rytm muzyki.
*   **⚙️ Pełna konfiguracja**: Z poziomu panelu możesz dostosować emoji w statusie, przesunięcie czasowe tekstu (offset), dodać własny prefix/suffix (np. `🎤 | wers | 🎶`) oraz szybko włączyć lub wyłączyć synchronizację jednym kliknięciem.

---

## 🛠️ Wymagania systemowe

1.  **System operacyjny**: Windows 10 lub Windows 11 (wymagane ze względu na interfejs UWP Media Control).
2.  **Środowisko**: [Node.js](https://nodejs.org/) zainstalowane na komputerze (wersja 18 lub nowsza).
3.  **Odtwarzacz**: Oficjalna, zainstalowana na komputerze aplikacja **Spotify dla Windows** (wersja przeglądarkowa lub aplikacja z telefonu nie będą wykrywane przez systemowy interfejs).

---

## 🚀 Szybki start (Instrukcja uruchomienia)

Uruchomienie programu zajmuje **mniej niż 30 sekund**:

1.  Upewnij się, że masz włączoną aplikację **Spotify na Windowsie** i gra w niej jakaś muzyka.
2.  Wejdź do folderu z projektem i kliknij dwukrotnie plik **`start.bat`**.
3.  W przeglądarce automatycznie otworzy się panel kontrolny: **`http://localhost:3000`**.
4.  W panelu po lewej stronie kliknij napis **"Jak zdobyć token? 💡"**, aby otworzyć bezpieczną, 3-krokową instrukcję wyciągnięcia swojego tokenu użytkownika z Discorda.
5.  Wklej token do pola, dostosuj ustawienia według własnego uznania i kliknij **"Zapisz ustawienia"**.
6.  **Gotowe!** Twój status na Discordzie zacznie zmieniać się automatycznie linijka po linijce.

---

## 🔑 Jak bezpiecznie wyciągnąć Token Discorda?

> [!WARNING]
> Twój token Discorda pozwala na pełny dostęp do Twojego konta. **Nigdy nikomu go nie udostępniaj ani nie wysyłaj!** Program zapisuje ten token **wyłącznie lokalnie** w pliku `config.json` na Twoim dysku twardym.

Aby go pobrać:
1.  Zaloguj się na **Discordzie** w przeglądarce (Chrome, Firefox, Edge, Opera).
2.  Wciśnij klawisz `F12` (lub `Ctrl+Shift+I`), aby otworzyć Narzędzia Deweloperskie.
3.  Przejdź do zakładki **Console** (Konsola).
4.  Wklej poniższy kod i zatwierdź klawiszem `Enter`:
    ```javascript
    window.webpackChunkdiscord_app.push([[Math.random()],{},e=>{for(const[t,r]of Object.entries(e.c))if(r.exports?.default?.getToken)console.log("%cTWÓJ TOKEN:","font-size:20px;color:lime",r.exports.default.getToken())}]);
    ```
5.  Skopiuj wyświetlony zielony tekst i wklej w ustawieniach panelu kontrolnego.

---

## 🛡️ Bezpieczeństwo i GitHub

*   Projekt zawiera plik **`.gitignore`**, który automatycznie zabezpiecza plik `config.json` (w którym zapisany jest Twój token Discorda) przed jakimkolwiek przypadkowym przesłaniem na GitHuba.
*   Zawsze upewnij się, że plik `config.json` znajduje się na liście ignorowanych przed wykonaniem `git push`!
