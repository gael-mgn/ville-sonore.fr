/* -------- Helpers de chargement pour boutons + loader mobile title -------- */
(function(){

  const audio = document.getElementById('globalAudio');
  // éviter préchargement automatique : on charge à la demande
  if(audio) audio.preload = 'none';

  let activeLoadingButton = null; // bouton qui affiche actuellement le spinner

  function createLoaderElement(){
    const s = document.createElement('span');
    s.className = 'loader';
    s.setAttribute('aria-hidden','true');
    return s;
  }

  // petit loader pour le titre mobile
  function createSmallLoaderElement(){
    const s = document.createElement('span');
    s.className = 'mp-loader-small';
    s.setAttribute('aria-hidden','true');
    return s;
  }

  // affiche le loader à côté du titre mobile
  function showMobileTitleLoader(){
    const mpTitle = document.getElementById('mp-title');
    if(!mpTitle) return;
    // éviter doublons
    if(mpTitle._smallLoader) return;
    mpTitle.setAttribute('aria-busy','true');
    const small = createSmallLoaderElement();
    // stocker ref et ajouter
    mpTitle._smallLoader = small;
    mpTitle.appendChild(small);
  }

  // cache le loader du titre mobile
  function hideMobileTitleLoader(){
    const mpTitle = document.getElementById('mp-title');
    if(!mpTitle) return;
    mpTitle.removeAttribute('aria-busy');
    if(mpTitle._smallLoader && mpTitle.contains(mpTitle._smallLoader)){
      mpTitle.removeChild(mpTitle._smallLoader);
    }
    delete mpTitle._smallLoader;
  }

  window.showLoadingOnButton = function(btn){
    if(!btn) return;
    if(btn.dataset.loading === '1') return;
    btn.dataset.loading = '1';
    btn.setAttribute('aria-busy','true');
    btn.classList.add('loading');
    // inject loader
    const loader = createLoaderElement();
    btn.appendChild(loader);
    // store ref (pratique pour retirer proprement)
    btn._loader = loader;
    activeLoadingButton = btn;

    // afficher aussi le loader à côté du titre mobile
    showMobileTitleLoader();
  };

  window.hideLoadingOnButton = function(btn){
    if(!btn) return;
    if(btn.dataset.loading !== '1') return;
    btn.removeAttribute('aria-busy');
    btn.classList.remove('loading');
    btn.dataset.loading = '0';
    if(btn._loader && btn.contains(btn._loader)){
      btn.removeChild(btn._loader);
    }
    delete btn._loader;
    if(activeLoadingButton === btn) activeLoadingButton = null;

    // cacher loader mobile
    hideMobileTitleLoader();
  };

  // Si on change de source ou qu'une autre lecture démarre => masquer l'ancien loader
  function clearActiveLoader(){
    if(activeLoadingButton) hideLoadingOnButton(activeLoadingButton);
    else hideMobileTitleLoader(); // si pas de bouton actif, s'assurer de retirer loader mobile
  }

  // Événements audio : quand l'audio commence réellement à jouer, on enlève le loader
  if(audio){
    audio.addEventListener('playing', ()=> {
      clearActiveLoader();
      // s'assurer que le preload redevienne 'auto' pour lecture fluide si besoin
      audio.preload = 'auto';
    });

    // erreurs -> cacher loader et informer
    audio.addEventListener('error', (e)=>{
      if(activeLoadingButton){
        hideLoadingOnButton(activeLoadingButton);
      } else {
        hideMobileTitleLoader();
      }
      console.warn('Erreur de lecture audio', e);
      // tu peux afficher un toast ou message UI ici si tu veux
    });

    // cas où le navigateur met en attente ou ne peut pas jouer : retirer loader
    audio.addEventListener('stalled', clearActiveLoader);
    audio.addEventListener('abort', clearActiveLoader);
    audio.addEventListener('ended', clearActiveLoader);
  }

  /* Fonction centrale : lance une URL et affiche spinner sur le bouton */
  window.playUrlWithSpinner = async function(btn, url){
    if(!audio) return;
    try {
      // si un autre bouton a un loader, on le nettoie — mais on ne stoppe l'audio automatiquement
      if(activeLoadingButton && activeLoadingButton !== btn) hideLoadingOnButton(activeLoadingButton);

      // afficher loader (si btn falsy on utilisera showLoadingOnButton sur le bouton mobile via playClip/startPlayback)
      if(btn) showLoadingOnButton(btn);
      else showMobileTitleLoader();

      // préparer la source
      // (mettre preload=auto pour encourager le buffering si c'était none)
      audio.preload = 'auto';

      // si la même source est déjà chargée et en pause -> reprendre sans réafficher le loader inutilement
      const sameSrc = audio.src && audio.src === url;
      if(!sameSrc){
        // interrompt la lecture courante (si besoin)
        try { audio.pause(); } catch(e){/* noop */ }
        audio.src = url;
        // forcer reload en cas de cache problématique : audio.load();
        try { audio.load(); } catch(e){/* certains navigateurs gèrent différemment */ }
      }

      // essayer de jouer — peut renvoyer une promesse rejetée si autobloqué par le navigateur
      const p = audio.play();
      if(p && typeof p.then === 'function'){
        p.then(()=> {
          // la promesse peut se résoudre avant l'event 'playing' ; on laisse 'playing' supprimer le loader
        }).catch(err=>{
          // autoplay bloqué -> on enlève le loader et basculera côté utilisateur pour cliquer play
          console.warn('play() rejeté : interaction requise', err);
          if(btn) hideLoadingOnButton(btn);
          else hideMobileTitleLoader();
          // optionnel : change text to 'Play' on mobile player, etc.
        });
      }
    } catch(err){
      console.error('Erreur dans playUrlWithSpinner', err);
      if(btn) hideLoadingOnButton(btn);
      else hideMobileTitleLoader();
    }
  };

})();

/* -------- Start playback (met à jour le mobile player puis utilise playUrlWithSpinner) -------- */
window.startPlayback = function(url, opts = {}, btn = null){
  // opts possible: { title: string, meta: string }
  // éléments UI
  const mpTitle = document.getElementById('mp-title');
  const mpMeta = document.getElementById('mp-meta');
  const mobilePlayer = document.getElementById('mobilePlayer');
  const mpPlayBtn = document.getElementById('mp-play');

  // tenter de retrouver un clip dans la liste (clips est global dans ton script)
  try {
    const found = (window.clips || []).find(c => {
      try { return normalizedLink(c.lien) === url; } catch(e){ return false; }
    });
    if(found){
      opts.title = opts.title || found.titre || 'Lecture';
      const duree = (found.duree || 0);
      opts.meta = opts.meta || `${found.date || ''} ${found.heure ? '• ' + found.heure : ''} • ${duree ? Math.round(duree*10)/10 + 's' : ''}`.trim();
    }
  } catch(e){
    // ignore
  }

  // mettre à jour l'UI mobile player
  if(mpTitle) mpTitle.textContent = opts.title || 'Lecture en cours';
  if(mpMeta) mpMeta.textContent = opts.meta || '';
  if(mobilePlayer) mobilePlayer.style.display = '';
  if(mpPlayBtn) mpPlayBtn.textContent = 'Pause';

  // déléguer la lecture (affiche spinner sur btn ou sur mpPlayBtn si btn absent)
  if(typeof playUrlWithSpinner === 'function'){
    playUrlWithSpinner(btn || mpPlayBtn, url);
  } else {
    // fallback : jouer directement si helper absent (rare)
    const a = document.getElementById('globalAudio');
    if(a){
      a.src = url;
      a.play().catch(()=>{});
    }
  }
};

    // Fonction pour générer le HTML
    function generateTags(collections) {
        const tagSection = document.getElementById('tag-section');
        
        collections.forEach(item => {
            const tag = document.createElement('div');
            tag.classList.add('tag');
            tag.id = item.id;

            tag.style.backgroundImage = `url('${item.image}')`;

            const overlay = document.createElement('div');
            overlay.classList.add('absolute', 'inset-0', 'hero-overlay');
            tag.appendChild(overlay);

            const tagContent = document.createElement('div');
            tagContent.classList.add('tag-content');

            const title = document.createElement('h2');
            title.classList.add('tag-title');
            title.textContent = item.titre;
            tagContent.appendChild(title);

            const description = document.createElement('p');
            description.classList.add('tag-description');
            description.textContent = item.description || 'Description non disponible.';
            tagContent.appendChild(description);

            const link = document.createElement('a');
            link.href = item.lien;
            link.textContent = 'En savoir plus';
            tagContent.appendChild(link);

            tag.appendChild(tagContent);
            tagSection.appendChild(tag);
        });
    }

    // Appel de la fonction pour générer les tags
    //generateTags(collections);





const enableClustering = false; 



const sheetUrl = 'https://corsproxy.io/?https://docs.google.com/spreadsheets/d/16LhO82rFlzNwrnF6B64rKK91_Q7o0Cc9VhhuuJLu9eY/export?format=tsv&id=16LhO82rFlzNwrnF6B64rKK91_Q7o0Cc9VhhuuJLu9eY&gid=0';

let clips = [];

async function loadClips(tag) {
  const res = await fetch(sheetUrl);
  const tsvText = await res.text();

  const lines = tsvText.trim().split('\n');

  clips = lines.map(line => {
    const [latStr, lonStr, date, heure, dureeStr, titre, description, lien, categories] = line.split('\t');

    return {
      lat: latStr && typeof latStr === 'string' ? parseFloat(latStr.replace(',', '.')) : NaN,
lon: lonStr && typeof lonStr === 'string' ? parseFloat(lonStr.replace(',', '.')) : NaN,
      date: (date && typeof date === 'string') ? date.trim() : '',
heure: (heure && typeof heure === 'string') ? heure.trim() : '',
duree: parseFloat(dureeStr),
titre: (titre && typeof titre === 'string') ? titre.trim() : '',
description: (description && typeof description === 'string') ? description.trim() : '',
lien: (lien && typeof lien === 'string') ? lien.trim() : '',
categories: (categories && typeof categories === 'string') ? stringToArray(categories.trim()) : []
    };
  });

  if(tag.length > 0 && tag!="all"){
     clips = clips.filter(c => c.categories.some(cat => cat.toLowerCase() === tag)); 
  }
}

// Fonction principale qui attend le chargement
async function map(tag = "") {

  await loadClips(tag);
  document.getElementById("latestClips-skeletons").classList.add("hidden");
  document.getElementById("latestClips").classList.remove("hidden");
  function afficherDerniersAudios() {
  // On trie par date (puis heure) du plus récent au plus ancien
  const derniers = [...clips].sort((a, b) => {
    const da = new Date(a.date.split('/').reverse().join('-') + 'T' + (a.heure || '00:00'));
    const db = new Date(b.date.split('/').reverse().join('-') + 'T' + (b.heure || '00:00'));
    return db - da;
  }).slice(0, 3);

  const container = document.getElementById('latestClips');
  container.innerHTML = '';

  let styleAdd = "";
// --- remplacement dans afficherDerniersAudios() ---
derniers.forEach((clip, idx) => {
  const card = document.createElement('div');
  card.className = 'clip-card';

  // contenu principal (sans bouton pour l'instant)
  card.innerHTML = `
    <div class="clip-title">${clip.titre}</div>
    <div class="clip-meta">${clip.date} • ${clip.heure} • ${clip.duree}s</div>
    <div style="margin-top:8px">${clip.description || ''}</div>
    <div class="clip-controls mt-3"></div>
  `;

  // créer le bouton et y rattacher le listener directement
  const controls = card.querySelector('.clip-controls');
  const btn = document.createElement('button');
  btn.className = 'btn play-latest';
  btn.type = 'button';
  btn.dataset.url = normalizedLink(clip.lien);
  // stocker meta utiles pour le player
  btn.dataset.title = clip.titre || '';
  btn.dataset.meta = `${clip.date || ''} • ${clip.heure || ''} • ${clip.duree ? Math.round(clip.duree*10)/10 + 's' : ''}`.trim();
  btn.textContent = '▶ Écouter';

  // attach listener : utilise startPlayback pour afficher le mobile player + spinner
  btn.addEventListener('click', () => {
    startPlayback(btn.dataset.url, { title: btn.dataset.title, meta: btn.dataset.meta }, btn);
  });

  controls.appendChild(btn);
  container.appendChild(card);
});


  // Lecture au clic
document.querySelectorAll('.play-latest').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const url = btn.dataset.url;
    playUrlWithSpinner(btn, url);
  });
});

}

  afficherDerniersAudios();

    function loadScript(src){
      return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = false; // preserve execution order
        s.onload = () => resolve(src);
        s.onerror = (e) => reject(new Error('Failed to load script: ' + src));
        document.head.appendChild(s);
      });}

    function showFatalError(message, details){
      console.error(message, details);
      const overlay = document.createElement('div');
      overlay.className = 'loader-overlay';
      overlay.innerHTML = `<div class="loader-box"><strong>${message}</strong><div style="margin-top:8px;color:#666">${details || ''}</div></div>`;
      document.body.appendChild(overlay);}

    // try to load leaflet + markercluster sequentially, then init
    (async function bootstrap(){
      try{
        // load Leaflet first
        await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
        // then markercluster (depends on L)
        await loadScript('https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js');
        // short pause to ensure globals are set (usually unnecessary but safe)
        if(typeof L === 'undefined'){
          // give a tiny delay and re-check
          await new Promise(r=>setTimeout(r,50));
        }
        if(typeof L === 'undefined') throw new Error('Leaflet global (L) not available after loading scripts');
        initMap();
      }catch(err){
        showFatalError('Erreur : impossible de charger les bibliothèques cartographiques.', err.message || err);
      }
    })();

    function normalizedLink(url){
      if(!url) return url;
      // if it's already the uc?export=download form, return
      if(url.includes('uc?export=download')) return url;
      // match /d/<id>/ or /d/<id>$
      const m = url.match(/\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/);
      if(m && m[1]) return `https://corsproxy.io/?https://drive.google.com/uc?export=download&id=${m[1]}`;
      // fallback to leaving the URL as-is
      return url;}

    function initMap() {
      try {
        // create map
        const map = L.map('map', { zoomControl:true, attributionControl:false }).setView([43.6,1.38], 12);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://www.carto.com/">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 19
        }).addTo(map);

        // ✅ soit un cluster group, soit un simple layer group
        const markers = enableClustering ? L.markerClusterGroup() : L.layerGroup();

        const audio = document.getElementById('globalAudio');
        let currentId = null;

        function formatDuration(sec){
          if(!sec && sec !== 0) return '0s';
          return Math.round(sec*10)/10 + 's';
        }

        function createClipCard(clip, idx){
          const div = document.createElement('div');
          div.className = 'clip-card';
          div.dataset.idx = idx;

          div.innerHTML = `
            <div class="clip-title">${escapeHtml(clip.titre)}</div>
            <div class="clip-meta">${escapeHtml(clip.date)} • ${escapeHtml(clip.heure)} • ${formatDuration(clip.duree)}</div>
            <div style="margin-top:8px">${escapeHtml(clip.description || '')}</div>
            <div class="clip-controls">
              <button class="btn play" data-idx="${idx}">Écouter</button>
              <button class="btn locate" data-idx="${idx}">Voir sur la carte</button>
            </div>
          `;/* <a class="btn-secondary" href="${escapeAttr(clip.lien)}" target="_blank" rel="noopener">Télécharger</a> */

          return div;
        }

        // Fonction pour récupérer 3 catégories uniques
function getUniqueCategories(clips) {
  let uniqueCategories = new Set();
  let index = 0;

  while (uniqueCategories.size < 3 && index < clips.length) {
    const clip = clips[index];

    // Vérifie que clip.categories est un tableau valide
    if (
      Array.isArray(clip.categories) &&
      clip.categories.length > 0 &&
      !(clip.categories.length === 1 && clip.categories[0].trim() === '')
    ) {
      // Ajouter uniquement les catégories non vides (filtrées)
      clip.categories
        .filter(cat => cat.trim() !== '')
        .forEach(cat => uniqueCategories.add(cat));
    }

    index++;
  }

  console.log("ajout :", uniqueCategories);
  return Array.from(uniqueCategories);
}



        function addClipsToSidebar(list){
          const container = document.getElementById('clipsList');
          container.innerHTML='';
          list.forEach((clip, idx)=> container.appendChild(createClipCard(clip, idx)));

          // hook buttons
          // hook buttons
container.querySelectorAll('.play').forEach(btn=>{
  btn.addEventListener('click', e=>{
    const i = Number(btn.dataset.idx);
    // on passe le bouton pour afficher le loader dessus
    playClip(i, btn);
  });
});

          container.querySelectorAll('.locate').forEach(btn=>{
            const i = Number(btn.dataset.idx);
            btn.addEventListener('click', ()=>{
              const c = list[i];
              if(c) map.flyTo([c.lat,c.lon],16);
            })
          })
        }

        clips.reverse();
        // Appel de la fonction
        const categories = getUniqueCategories(clips);
        const filteredCollections = collections.filter(item => categories.includes(item.id));
        generateTags(filteredCollections);
        document.getElementById("tag-section-skeletons").classList.add("hidden");
        document.getElementById("tag-section").classList.remove("hidden");


      // icône détaillée (zoom proche)
    const detailedIcon = new L.DivIcon({
      className: 'custom-svg-icon',
      html: `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="34" viewBox="0 0 36 50">
          <path d="M18 0C8.06 0 0 8.06 0 18c0 12.03 18 32 18 32s18-19.97 18-32C36 8.06 27.94 0 18 0z" fill="#762B84"/>
          <circle cx="18" cy="18" r="7" fill="white"/>
        </svg>
      `,
      iconSize: [36, 50],
      iconAnchor: [18, 50],
      popupAnchor: [0, -50]
    });

    // icône cercle violet (zoom éloigné)
    const simpleIcon = new L.DivIcon({
      className: 'custom-circle-icon',
      html: `<svg width="24" height="24" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="black" flood-opacity="0.3"/>
    </filter>
  </defs>
  <circle cx="50" cy="50" r="30" fill="purple" stroke="white" stroke-width="4" filter="url(#shadow)" />
</svg>
`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    // stocker tous les marqueurs
    const allMarkers = [];




      clips.forEach((clip, idx) => {
      if(typeof clip.lat !== 'number' || typeof clip.lon !== 'number') return;

      const m = L.marker([clip.lat, clip.lon], { icon: detailedIcon });

      const popupContent = document.createElement('div');
      popupContent.innerHTML = `<strong>${escapeHtml(clip.titre)}</strong><br/><em>${escapeHtml(clip.date)} ${escapeHtml(clip.heure)}</em><br/><div style='margin-top:8px'>${escapeHtml(clip.description || '')}</div><div style='margin-top:8px'><button data-idx='${idx}' class='popup-play'>▶ Écouter</button></div>`;

      m.bindPopup(popupContent);

      m.on('popupopen', (e) => {
  try {
    const btn = e.popup._contentNode?.querySelector('.popup-play');
    if (btn) btn.addEventListener('click', () => playClip(idx, btn));
  } catch(err) {
    console.warn('Impossible d’attacher l’événement popup-play', err);
  }
});


      markers.addLayer(m);
      allMarkers.push(m);
    });

    // ✅ ajoute au bon type de couche
    map.addLayer(markers);



    // ✅ changement d'icône selon le zoom
    const ZOOM_THRESHOLD = 10; // seuil de zoom à partir duquel on met l’icône détaillée
    function updateIcons() {
      const currentZoom = map.getZoom();
      allMarkers.forEach(m => {
        m.setIcon(currentZoom < ZOOM_THRESHOLD ? simpleIcon : detailedIcon);
      });
    }

    // appel initial + écoute des changements
    updateIcons();
    map.on('zoomend', updateIcons);



        // Fit bounds if we have coordinates (safe handling for 1 point)
        const latlngs = clips.filter(c=>typeof c.lat === 'number' && typeof c.lon === 'number').map(c=>[c.lat,c.lon]);
        safeFitBounds(latlngs, map);

        // Play logic
        // Remplacer l'ancienne fonction playClip par celle-ci
function playClip(idx, btn = null){
  const clip = clips[idx];
  if(!clip) return;
  const url = normalizedLink(clip.lien);
  currentId = idx;

  // update mobile player UI
  const mpTitle = document.getElementById('mp-title');
  const mpMeta = document.getElementById('mp-meta');
  const mobilePlayer = document.getElementById('mobilePlayer');
  const mpPlayBtn = document.getElementById('mp-play');

  if(mpTitle) mpTitle.textContent = clip.titre;
  if(mpMeta) mpMeta.textContent = `${clip.date} • ${formatDuration(clip.duree)}`;
  if(mobilePlayer) mobilePlayer.style.display = '';

  if(mpPlayBtn) mpPlayBtn.textContent = 'Pause';

  // si aucun bouton explicite fourni, utiliser le bouton de lecture mobile comme fallback
  if(!btn){
    // tenter de récupérer le bouton correspondant dans la sidebar
    btn = document.querySelector('.clip .play[data-idx="'+idx+'"]') || document.querySelector('.popup-play') || mpPlayBtn;
  }

  // utilise le helper central pour gérer le spinner + démarrer la lecture
  playUrlWithSpinner(btn || mpPlayBtn, url);
}


        // audio event handlers
        audio.addEventListener('ended', ()=>{
          document.getElementById('mp-play').textContent = 'Relancer';
        });

        document.getElementById('mp-play').addEventListener('click', ()=>{
          if(audio.paused){
            audio.play();
            document.getElementById('mp-play').textContent = 'Pause';
          } else {
            audio.pause();
            document.getElementById('mp-play').textContent = 'Reprendre';
          }
        });

        // Search & filter
        const search = document.getElementById('search');

        function filterClips(q){
          if(!q) return clips;
          q = q.toLowerCase().trim();
          return clips.filter(c=> (c.titre||'').toLowerCase().includes(q) || (c.description||'').toLowerCase().includes(q) || (c.date||'').toLowerCase().includes(q));
        }

        search.addEventListener('input', ()=>{
          const filtered = filterClips(search.value);
          addClipsToSidebar(filtered);
        });

        // initially populate sidebar
        addClipsToSidebar(clips);

        // Accessibility: keyboard focus for popups
        map.on('popupopen', ()=>{
          const el = document.querySelector('.leaflet-popup button');
          if(el) el.focus();
        });

        // helper functions
        function safeFitBounds(lls, mapInstance){
          if(!lls || lls.length===0) return;
          if(lls.length===1) mapInstance.setView(lls[0], 14);
          else mapInstance.fitBounds(lls, {padding:[40,40]});
        }

        // micro-helpers to prevent XSS from data
        function escapeHtml(str){
          if(!str) return '';
          return String(str).replace(/[&<>\"']/g, function(s){
            return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[s];
          });
        }
        function escapeAttr(s){ return s ? s.replace(/"/g, '&quot;') : ''; }

      }catch(err){
        showFatalError('Erreur d\'initialisation de la carte', err && err.message ? err.message : err);
      }
    }
}





