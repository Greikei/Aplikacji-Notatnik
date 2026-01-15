//nazwa magazynu
const CACHE_NAME = 'note-helper-v1';
//pliki jakie maja zostac dodane do magazynu podczas pierwszej instalacji
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
];
//instalacja service workera przy pierwszym odpaleniu aplikacji
self.addEventListener('install', (e) => {
    //oczekiwanie na pobranie wszystkich plików
    e.waitUntil(
        //otworzy nam magazyn w cache storage o nazwie note-helper-1 
        caches.open(CACHE_NAME).then((cache) => {
            //doda nam do naszego magazynu wszystkie pliki zwiazane z aplikacją
            return cache.addAll(ASSETS);
        })
    );
});

//nasluchiwanie kazdego zapytania ze strony
self.addEventListener('fetch', (e) => {
    //jak ma opowiedzieć 
    e.respondWith(
        //jeżeli ma ten plik w magazynie note-helper-1, zwroci go bez zadnego problemu
        caches.match(e.request).then((response) => {
            //jezeli go nie ma, bedzie starał sie pobrac te dane z internetu
            return response || fetch(e.request);
        })
    );
});