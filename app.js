//tworzymy sobie stałe
const app = {
    notes: [],
    temp: { img: null, audio: null },
    recorder: null,
    chunks: [],
//inicjalizujemy  start aplikacji

    init: () => {
        // sprawdzamy czy service worker jest obslugiwany przez przegladarké
        if ('serviceWorker' in navigator) {
            //jezeli tak rejestrujemy sobie nasz plik service workera
            navigator.serviceWorker.register('./sw.js')
            //wypisanie bledu lub sukcesu w konsoli
                .then(() => console.log("SW zarejestrowany"))
                .catch(err => console.log("Błąd SW:", err));
                
        }
        //proba wczytania notatek z pamieci
        app.loadNotes();

        app.setupEventListeners();
        app.updateOnlineStatus();
        window.addEventListener('online', app.updateOnlineStatus);
        window.addEventListener('offline', app.updateOnlineStatus);
        //wyswietlenie listy notatek 
        app.render();
    },
    // obsluga zdarzen - przyciskow
    setupEventListeners: () => {
        document.getElementById('btn-add-note').onclick = () => app.showView('view-editor'); //przelaczenie widoku na edytor dodawania notatki
        document.getElementById('btn-save').onclick = app.saveNote;// uruchomi sie funkcja od zapisu notatki
        document.getElementById('btn-cancel').onclick = app.clearAndHome; // czysci formularz i wrocimy do ekranu "notatki"
        document.getElementById('btn-geo').onclick = app.getGeo; // uruchomienie funkcji od pobierania pozycji gps
        document.getElementById('btn-record').onclick = app.toggleMic; // przycisk od funkcji wlaczenia i wylaczenia mikrofonu
        document.getElementById('camera-input').onchange = app.handleCam; // gdy dodamy zdjecie lub zrobimy nowe, obsluzy tnam ten plik
    },

    //funkcja od aktualizacji ikonki
    updateOnlineStatus: () => {
        //pobiera nam z przegladarki element html ktory jest wskaznikiem braku sieci
        const indicator = document.getElementById('offline-indicator');
        //jesli mamy internet to ikonka polaczenia dostanie atrybut hidden, nie bedzie jej widac
        if (navigator.onLine) {
            indicator.classList.add('hidden');
            //jesli nie mamy internetu z ikonki usuwamy atrybut hidden, ikonka jest widoczna
        } else {
            indicator.classList.remove('hidden');
        }
    },
    //funkcja od zarzadzania ekranami
    showView: (id) => {
        //znajdujemy wszystkie ekranu typu, szczegoly notatki, ekran dodawania notatki, ekran glosowek i chowamy je
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        //znajdujemy wszystkie przyciski na dole ekranu i odznaczamy je
        document.querySelectorAll('.tab-bar button').forEach(b => b.classList.remove('active'));
        
        //pobieramy widok ekranu  o podanym id i pokazujemy go dodajac mu klase active
        document.getElementById(id).classList.add('active');
        //jesli jestesmy w glownym ekranie "notatki", to przycisk na dole ekranu odpowiadajacy temu ekranowi zostaje podswietlony
        if(id === 'view-home') document.getElementById('tab-home').classList.add('active');
        //jesli jestesmy na ekranie "glosowki" przycisk od tego ekranu zostanie podswietlony
        if(id === 'view-voices') document.getElementById('tab-voices').classList.add('active');
        // slownik 
        const titles = { 
            'view-home': 'Moje Notatki', 
            'view-voices': 'Moje Głosówki', 
            'view-editor': 'Nowa Notatka', 
            'view-detail': 'Szczegóły' 
        };
        document.getElementById('nav-title').textContent = titles[id] || 'NoteHelper';
    },

        //funkcja od geolokalizacji
        getGeo: () => {
  const s = document.getElementById('geo-status');
  //komunikat ładowania
  s.textContent = "Ustalanie lokalizacji...";
  //prosba do przegladarki o wspolrzedne
  navigator.geolocation.getCurrentPosition(
    async (p) => {
      try {
        //kontroler od anulowania zapytania o lokalizacje (niezbedny do dzialania aplikacji przez hostingi)
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 8000);

        //wysylamy zapytanie do api o latitude i longlitude i czekamy na odpowiedz 8 sekund, jesli nie dostaniemy odpowiedzi przerywa nam wysylanie zapytania
        const res = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${p.coords.latitude}&longitude=${p.coords.longitude}&localityLanguage=pl`,
          { signal: controller.signal }
        );
        // zamieniamy odpowiedz na plik json
        const d = await res.json();

        //nazwe miasta 
        const city =
          d.city ||
          d.locality ||
          d.principalSubdivision ||
          '';

        //tworzenie tekstu City - np "Warszawa, PL"
        const addr = city
          ? `${city}, ${d.countryCode}`
          : 'Lokalizacja przybliżona';

        s.textContent = "📍 " + addr;
        s.dataset.addr = addr;

        //wylapywanie bledow podczas trybu offline albo bledu api
      } catch (e) {
        console.error(e);
        s.textContent = "📍 Lokalizacja niedostępna";
      }
    },
    //jesli uzytkownik nie udostepni gps dostaniemy ten komunikat 
    () => {
      s.textContent = "❌ Brak zgody lub błąd lokalizacji";
    },
    //ustawienia gps
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
},

    //funkcja od glosowek, nagrywania dzwieku
    toggleMic: async () => {
        const btn = document.getElementById('btn-record');
        if (!app.recorder || app.recorder.state === "inactive") {
            // prosimy uzytkownika o dostęp do mikrofonu
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            //tworzymy nowa instancje
            app.recorder = new MediaRecorder(stream);
            //czyscimy tablice z nagrywkami
            app.chunks = [];
            //gdy dostaniemy jakas nagrywke to dodajemy ja do naszej tablicy chunks
            app.recorder.ondataavailable = e => app.chunks.push(e.data);
            //po zatrzymaniu nagrywania dodajemy definicje co ma sie stać 
            app.recorder.onstop = () => {
                const blob = new Blob(app.chunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onload = e => {
                    app.temp.audio = e.target.result;
                    document.getElementById('audio-preview').innerHTML = `<audio controls src="${e.target.result}"></audio>`;
                };
                reader.readAsDataURL(blob);
            };
            //rozpoczynanie nagrywania
            app.recorder.start();
            //zmieniamy tekst przycisku jesli nagrywamy
            btn.textContent = "🛑 Zatrzymaj";
        } else {
            //jesli nie nagrywamy nic zmieniamy ikone 
            app.recorder.stop();
            btn.textContent = "🎤 Nagraj głos";
        }
    },
    //funkcja obslugi pliku z kamery
    handleCam: (e) => {
        //odczyt plikow z dysku uzytkownika
        const reader = new FileReader();
        reader.onload = ev => {
            //zapisujemy dane obrazka jako zmienna tymczasowa
            app.temp.img = ev.target.result;
            //wstawiamy tag do pliku by dzialal jako element htmlowy
            document.getElementById('image-preview').innerHTML = `<img src="${ev.target.result}" style="width:100%; margin-top:10px; border-radius:8px;">`;
        };
        reader.readAsDataURL(e.target.files[0]);
    },

   //funkcja zapisywania notatki
    saveNote: () => {
        const title = document.getElementById('note-title').value;
        if (!title) return alert("Tytuł jest wymagany!");
        
        app.notes.push({
            id: Date.now(),
            title,
            body: document.getElementById('note-body').value,
            geo: document.getElementById('geo-status').dataset.addr || '',
            image: app.temp.img,
            audio: app.temp.audio,
            date: new Date().toLocaleDateString('pl-PL')
        });
        
        localStorage.setItem('gs_notes', JSON.stringify(app.notes));
        app.clearAndHome();
    },
        // funkcja z kafelkami notatek 
    render: () => {
        const list = document.getElementById('notes-list');
        const vList = document.getElementById('voice-notes-list');
        list.innerHTML = ''; vList.innerHTML = '';

        [...app.notes].reverse().forEach(n => {
            const card = document.createElement('div');
            card.className = 'note-card';
            card.onclick = () => app.renderDetail(n.id);
            card.innerHTML = `<strong>${n.title}</strong><br><small>${n.date} ${n.audio ? '🎤' : ''}</small>`;
            list.appendChild(card);

            if (n.audio) {
                const vCard = document.createElement('div');
                vCard.className = 'voice-card';
                vCard.onclick = () => app.renderDetail(n.id);
                vCard.innerHTML = `<div style="font-size:2rem">🎤</div><strong>${n.title}</strong><br><small>${n.date}</small>`;
                vList.appendChild(vCard);
            }
        });
    },
    // funkcja odpowiedzialna za szczegoly notatki
    renderDetail: (id) => {
        const n = app.notes.find(x => x.id === id);
        const cont = document.getElementById('detail-content');
        cont.innerHTML = `
            <h2>${n.title}</h2>
            <p style="margin:15px 0; white-space: pre-wrap;">${n.body}</p>
            ${n.image ? `<img src="${n.image}" style="width:100%; border-radius:10px;">` : ''}
            ${n.audio ? `<audio controls src="${n.audio}" style="width:100%; margin-top:10px;"></audio>` : ''}
            <div style="color:#777; font-size:0.85rem; margin-top:20px; border-top:1px solid #ddd; padding-top:10px;">
                📍 ${n.geo || 'Brak adresu'}<br>📅 ${n.date}
            </div>
            <button class="btn-danger full-width" style="margin-top:20px" onclick="app.deleteNote(${n.id})">Usuń notatkę</button>
        `;
        app.showView('view-detail');
    },
    //funkcja usuwania notatki
    deleteNote: (id) => {
        if(confirm("Czy na pewno chcesz usunąć tę notatkę?")) {
            app.notes = app.notes.filter(n => n.id !== id);
            localStorage.setItem('gs_notes', JSON.stringify(app.notes));
            app.showView('view-home');
            app.render();
        }
    },
    //funkcja wczytywania plikow z localstorage z ppamieci przegladarki
    loadNotes: () => {
        const s = localStorage.getItem('gs_notes');
        if (s) app.notes = JSON.parse(s);
    },
        // funkcja do wyczyszczenia formularza dodawania notatek
    clearAndHome: () => {
        app.temp = { img: null, audio: null };
        document.getElementById('note-title').value = '';
        document.getElementById('note-body').value = '';
        document.getElementById('geo-status').textContent = '';
        document.getElementById('image-preview').innerHTML = '';
        document.getElementById('audio-preview').innerHTML = '';
        app.showView('view-home');
        app.render();
    }
};

document.addEventListener('DOMContentLoaded', app.init);