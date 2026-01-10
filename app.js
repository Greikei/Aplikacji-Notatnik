const app = {
    notes: [],
    temp: { img: null, audio: null },
    recorder: null,
    chunks: [],

    init: () => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then(() => console.log("SW zarejestrowany"))
                .catch(err => console.log("Błąd SW:", err));
        }

        app.loadNotes();
        app.setupEventListeners();
        app.updateOnlineStatus();
        window.addEventListener('online', app.updateOnlineStatus);
        window.addEventListener('offline', app.updateOnlineStatus);
        
        app.render();
    },

    setupEventListeners: () => {
        document.getElementById('btn-add-note').onclick = () => app.showView('view-editor');
        document.getElementById('btn-save').onclick = app.saveNote;
        document.getElementById('btn-cancel').onclick = app.clearAndHome;
        document.getElementById('btn-geo').onclick = app.getGeo;
        document.getElementById('btn-record').onclick = app.toggleMic;
        document.getElementById('camera-input').onchange = app.handleCam;
    },

    updateOnlineStatus: () => {
        const indicator = document.getElementById('offline-indicator');
        if (navigator.onLine) {
            indicator.classList.add('hidden');
        } else {
            indicator.classList.remove('hidden');
        }
    },

    showView: (id) => {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.tab-bar button').forEach(b => b.classList.remove('active'));
        
        document.getElementById(id).classList.add('active');
        
        if(id === 'view-home') document.getElementById('tab-home').classList.add('active');
        if(id === 'view-voices') document.getElementById('tab-voices').classList.add('active');

        const titles = { 
            'view-home': 'Moje Notatki', 
            'view-voices': 'Moje Głosówki', 
            'view-editor': 'Nowa Notatka', 
            'view-detail': 'Szczegóły' 
        };
        document.getElementById('nav-title').textContent = titles[id] || 'GeoSnap';
    },

        getGeo: () => {
  const s = document.getElementById('geo-status');
  s.textContent = "Ustalanie lokalizacji...";

  navigator.geolocation.getCurrentPosition(
    async (p) => {
      try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 8000);

        const res = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${p.coords.latitude}&longitude=${p.coords.longitude}&localityLanguage=pl`,
          { signal: controller.signal }
        );

        const d = await res.json();

        const city =
          d.city ||
          d.locality ||
          d.principalSubdivision ||
          '';

        const addr = city
          ? `${city}, ${d.countryCode}`
          : 'Lokalizacja przybliżona';

        s.textContent = "📍 " + addr;
        s.dataset.addr = addr;

      } catch (e) {
        console.error(e);
        s.textContent = "📍 Lokalizacja niedostępna";
      }
    },
    () => {
      s.textContent = "❌ Brak zgody lub błąd lokalizacji";
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
},


    toggleMic: async () => {
        const btn = document.getElementById('btn-record');
        if (!app.recorder || app.recorder.state === "inactive") {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            app.recorder = new MediaRecorder(stream);
            app.chunks = [];
            app.recorder.ondataavailable = e => app.chunks.push(e.data);
            app.recorder.onstop = () => {
                const blob = new Blob(app.chunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onload = e => {
                    app.temp.audio = e.target.result;
                    document.getElementById('audio-preview').innerHTML = `<audio controls src="${e.target.result}"></audio>`;
                };
                reader.readAsDataURL(blob);
            };
            app.recorder.start();
            btn.textContent = "🛑 Zatrzymaj";
        } else {
            app.recorder.stop();
            btn.textContent = "🎤 Nagraj głos";
        }
    },

    handleCam: (e) => {
        const reader = new FileReader();
        reader.onload = ev => {
            app.temp.img = ev.target.result;
            document.getElementById('image-preview').innerHTML = `<img src="${ev.target.result}" style="width:100%; margin-top:10px; border-radius:8px;">`;
        };
        reader.readAsDataURL(e.target.files[0]);
    },

   
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

    deleteNote: (id) => {
        if(confirm("Czy na pewno chcesz usunąć tę notatkę?")) {
            app.notes = app.notes.filter(n => n.id !== id);
            localStorage.setItem('gs_notes', JSON.stringify(app.notes));
            app.showView('view-home');
            app.render();
        }
    },

    loadNotes: () => {
        const s = localStorage.getItem('gs_notes');
        if (s) app.notes = JSON.parse(s);
    },

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