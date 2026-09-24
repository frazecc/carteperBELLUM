/**
 * Bellum Penumbrum - Creatore Carte
 * Gestione creazione, modifica e eliminazione carte su Supabase
 * CON COMPRESSIONE IMMAGINI WEBP E GESTIONE EFFETTI DINAMICI
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { getAllEffects, generateEffectJSON, generateEffectText, getEffectConfig, addNewEffect, deleteEffectById } from './effects.js';

// ============================================
// CONFIGURAZIONE SUPABASE
// ============================================
const SUPABASE_URL = 'https://dgsqxnmrjfvklnjliplh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ZwwwsHnjEWNbe2CnDKsTSA_8ljXZlOG';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// STATO DELL'APPLICAZIONE
// ============================================
const AppState = {
    currentImageFile: null,
    currentImageUrl: null,
    addedEffects: [],
    allCards: [],
    selectedCardId: null,
    selectedEffectId: null
};

// ============================================
// INIZIALIZZAZIONE
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('Creatore Carte inizializzato');
    console.log('Supabase client creato:', supabase ? 'OK' : 'ERRORE');
    
    initEffectSelector();
    initEffectsManagement();
    setupEventListeners();
    loadAllCards();
    
    // Inizializza stats row correttamente
    const cardTypeSelect = document.getElementById('card-type');
    const statsRow = document.getElementById('stats-row');
    if (cardTypeSelect.value && ['monster', 'mostrissimo'].includes(cardTypeSelect.value)) {
        statsRow.style.display = 'grid';
    } else {
        statsRow.style.display = 'none';
    }
});

// ============================================
// GESTIONE EFFETTI - SELECTOR
// ============================================
function initEffectSelector() {
    // Forza reset agli effetti default se localStorage è vuoto
    const stored = localStorage.getItem('bellum_effects');
    if (!stored) {
        console.log('Nessun effetto in localStorage, uso default');
    }
    
    populateEffectSelector();
    renderEffectsManagementList();
}

function populateEffectSelector() {
    const effectSelect = document.getElementById('effect-type');
    effectSelect.innerHTML = '<option value="">Seleziona effetto...</option>';
    
    const effects = getAllEffects();
    console.log('Effetti caricati:', effects.length);
    
    effects.forEach(effect => {
        const option = document.createElement('option');
        option.value = effect.id;
        option.textContent = effect.name;
        option.title = effect.description;
        effectSelect.appendChild(option);
    });
}

function renderEffectParams(effectId) {
    const paramsContainer = document.getElementById('effect-params');
    paramsContainer.innerHTML = '';
    
    const effect = getEffectConfig(effectId);
    if (!effect || !effect.params || effect.params.length === 0) {
        return;
    }
    
    effect.params.forEach(param => {
        const wrapper = document.createElement('div');
        
        const label = document.createElement('label');
        label.textContent = param.label;
        label.style.fontSize = '0.75rem';
        label.style.color = 'var(--text-secondary)';
        wrapper.appendChild(label);
        
        if (param.type === 'number') {
            const input = document.createElement('input');
            input.type = 'number';
            input.id = `param-${param.name}`;
            input.min = param.min || 0;
            input.max = param.max || 99;
            input.value = param.default || 0;
            wrapper.appendChild(input);
        } else if (param.type === 'select') {
            const select = document.createElement('select');
            select.id = `param-${param.name}`;
            
            param.options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.label;
                select.appendChild(option);
            });
            
            wrapper.appendChild(select);
        }
        
        paramsContainer.appendChild(wrapper);
    });
}

function addEffectToCard() {
    const effectSelect = document.getElementById('effect-type');
    const effectId = effectSelect.value;
    
    if (!effectId) {
        alert('Seleziona un effetto!');
        return;
    }
    
    const effect = getEffectConfig(effectId);
    const params = {};
    
    // Raccogli parametri
    effect.params?.forEach(param => {
        const input = document.getElementById(`param-${param.name}`);
        if (input) {
            params[param.name] = input.value;
        }
    });
    
    // Genera JSON e testo
    const effectJSON = generateEffectJSON(effectId, params);
    const effectText = generateEffectText(effectId, params);
    
    // Aggiungi alla lista
    AppState.addedEffects.push({
        id: effectId,
        name: effect.name,
        params,
        json: effectJSON,
        text: effectText
    });
    
    renderEffectsList();
    
    // Resetta select
    effectSelect.value = '';
    document.getElementById('effect-params').innerHTML = '';
}

function renderEffectsList() {
    const effectsList = document.getElementById('effects-list');
    
    if (AppState.addedEffects.length === 0) {
        effectsList.innerHTML = '<p class="no-effects">Nessun effetto aggiunto. Seleziona dalla lista in basso.</p>';
        return;
    }
    
    effectsList.innerHTML = '';
    
    AppState.addedEffects.forEach((effect, index) => {
        const item = document.createElement('div');
        item.className = 'effect-item';
        
        const info = document.createElement('div');
        info.className = 'effect-info';
        
        const name = document.createElement('div');
        name.className = 'effect-name';
        name.textContent = effect.name;
        
        const details = document.createElement('div');
        details.className = 'effect-details';
        details.textContent = effect.text;
        
        info.appendChild(name);
        info.appendChild(details);
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-remove';
        removeBtn.textContent = 'Rimuovi';
        removeBtn.addEventListener('click', () => removeEffectFromCard(index));
        
        item.appendChild(info);
        item.appendChild(removeBtn);
        
        effectsList.appendChild(item);
    });
}

function removeEffectFromCard(index) {
    AppState.addedEffects.splice(index, 1);
    renderEffectsList();
}

// ============================================
// GESTIONE EFFETTI - MANAGEMENT SECTION
// ============================================
function initEffectsManagement() {
    renderEffectsManagementList();
    
    // Form nuovo effetto
    document.getElementById('effect-form').addEventListener('submit', handleNewEffectSubmit);
    
    // Modali
    document.getElementById('effect-modal-close').addEventListener('click', closeEffectModal);
    document.getElementById('effect-modal-delete').addEventListener('click', confirmDeleteEffect);
}

function renderEffectsManagementList() {
    const container = document.getElementById('effects-list-container');
    container.innerHTML = '';
    
    const effects = getAllEffects();
    
    if (effects.length === 0) {
        container.innerHTML = '<p class="no-effects">Nessun effetto presente. Crea il primo!</p>';
        return;
    }
    
    effects.forEach(effect => {
        const card = document.createElement('div');
        card.className = 'effect-card';
        
        const header = document.createElement('div');
        header.className = 'effect-card-header';
        
        const title = document.createElement('span');
        title.className = 'effect-card-title';
        title.textContent = effect.name;
        
        const actions = document.createElement('div');
        actions.className = 'effect-card-actions';
        
        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn-view';
        viewBtn.textContent = 'Vedi';
        viewBtn.addEventListener('click', () => viewEffect(effect.id));
        
        actions.appendChild(viewBtn);
        
        header.appendChild(title);
        header.appendChild(actions);
        
        const body = document.createElement('div');
        body.className = 'effect-card-body';
        body.textContent = effect.description;
        
        card.appendChild(header);
        card.appendChild(body);
        
        container.appendChild(card);
    });
}

function handleNewEffectSubmit(event) {
    event.preventDefault();
    
    const newEffect = {
        id: document.getElementById('effect-id').value.trim(),
        name: document.getElementById('effect-name').value.trim(),
        description: document.getElementById('effect-description').value.trim(),
        params: [],
        generateJSON: document.getElementById('effect-generate-json').value.trim(),
        generateText: document.getElementById('effect-generate-text').value.trim()
    };
    
    try {
        addNewEffect(newEffect);
        alert(`Effetto "${newEffect.name}" creato con successo!`);
        
        // Reset form
        document.getElementById('effect-form').reset();
        
        // Ricarica liste
        populateEffectSelector();
        renderEffectsManagementList();
        
    } catch (error) {
        alert(`Errore: ${error.message}`);
    }
}

function viewEffect(effectId) {
    const effect = getEffectConfig(effectId);
    if (!effect) return;
    
    AppState.selectedEffectId = effectId;
    
    const modal = document.getElementById('effect-modal');
    const title = document.getElementById('effect-modal-title');
    
    title.textContent = effect.name;
    modal.style.display = 'flex';
}

function closeEffectModal() {
    const modal = document.getElementById('effect-modal');
    modal.style.display = 'none';
    AppState.selectedEffectId = null;
}

function confirmDeleteEffect() {
    if (!AppState.selectedEffectId) return;
    
    const effect = getEffectConfig(AppState.selectedEffectId);
    if (!effect) return;
    
    const confirmed = confirm(`Eliminare l'effetto "${effect.name}"?`);
    if (!confirmed) return;
    
    try {
        deleteEffectById(AppState.selectedEffectId);
        alert('Effetto eliminato!');
        
        closeEffectModal();
        populateEffectSelector();
        renderEffectsManagementList();
        
    } catch (error) {
        alert(`Errore: ${error.message}`);
    }
}

// ============================================
// COMPRESSIONE IMMAGINE WEBP
// ============================================
async function compressImageToWebP(file, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Ridimensiona se troppo grande (max 800px)
                let width = img.width;
                let height = img.height;
                const maxSize = 800;
                
                if (width > maxSize || height > maxSize) {
                    const ratio = Math.min(maxSize / width, maxSize / height);
                    width = Math.floor(width * ratio);
                    height = Math.floor(height * ratio);
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Disegna immagine
                ctx.drawImage(img, 0, 0, width, height);
                
                // Converti in WebP
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Conversione WebP fallita'));
                        }
                    },
                    'image/webp',
                    quality
                );
            };
            
            img.onerror = () => reject(new Error('Errore caricamento immagine'));
            img.src = e.target.result;
        };
        
        reader.onerror = () => reject(new Error('Errore lettura file'));
        reader.readAsDataURL(file);
    });
}

// ============================================
// GESTIONE IMMAGINE
// ============================================
async function handleImageUpload(event) {
    const file = event.target.files[0];
    
    if (!file) return;
    
    // Verifica tipo file
    const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        alert('Formato immagine non valido. Usa PNG, JPEG o WebP.');
        event.target.value = '';
        return;
    }
    
    try {
        // Comprimi in WebP
        showMessage('Compressione immagine in corso...', 'success');
        const compressedBlob = await compressImageToWebP(file, 0.7);
        
        AppState.currentImageFile = compressedBlob;
        
        // Mostra anteprima
        const reader = new FileReader();
        reader.onload = (e) => {
            AppState.currentImageUrl = e.target.result;
            
            const preview = document.getElementById('image-preview');
            preview.innerHTML = `<img src="${e.target.result}" alt="Anteprima">`;
            
            // Aggiorna anche anteprima carta
            updateCardPreview();
            
            showMessage('Immagine compressa con successo!', 'success');
        };
        reader.readAsDataURL(compressedBlob);
        
    } catch (error) {
        console.error('Errore compressione:', error);
        alert(`Errore compressione immagine: ${error.message}`);
        event.target.value = '';
    }
}

async function uploadImageToSupabase(cardId, factionCode) {
    if (!AppState.currentImageFile) return null;
    
    const filePath = `${factionCode}/${cardId}.webp`;
    
    const { data, error } = await supabase.storage
        .from('card-images')
        .upload(filePath, AppState.currentImageFile, {
            upsert: true,
            contentType: 'image/webp'
        });
    
    if (error) {
        console.error('Errore upload immagine:', error);
        throw error;
    }
    
    // Ottieni URL pubblico
    const { data: { publicUrl } } = supabase.storage
        .from('card-images')
        .getPublicUrl(filePath);
    
    return publicUrl;
}

// ============================================
// GESTIONE FORM
// ============================================
function setupEventListeners() {
    // Upload immagine
    document.getElementById('card-image').addEventListener('change', handleImageUpload);
    
    // Mostra/nascondi stats in base al tipo - FIX CORRETTO
    const cardTypeSelect = document.getElementById('card-type');
    const statsRow = document.getElementById('stats-row');
    
    cardTypeSelect.addEventListener('change', (e) => {
        const type = e.target.value;
        
        if (['monster', 'mostrissimo'].includes(type)) {
            statsRow.style.display = 'grid';
        } else {
            statsRow.style.display = 'none';
        }
        
        updateCardPreview();
    });
    
    // Aggiorna anteprima in tempo reale
    ['card-name', 'card-type', 'faction', 'mana-cost', 'attack', 'hp', 'effect-text'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateCardPreview);
    });
    
    // Aggiungi effetto
    document.getElementById('btn-add-effect').addEventListener('click', addEffectToCard);
    
    // Submit form
    document.getElementById('card-form').addEventListener('submit', handleFormSubmit);
    
    // Anteprima
    document.getElementById('btn-preview').addEventListener('click', (e) => {
        e.preventDefault();
        updateCardPreview();
        alert('✅ Anteprima aggiornata! Guarda la sezione a destra.');
    });
    
    // Reset form
    document.getElementById('card-form').addEventListener('reset', () => {
        setTimeout(() => {
            AppState.addedEffects = [];
            AppState.currentImageFile = null;
            AppState.currentImageUrl = null;
            renderEffectsList();
            document.getElementById('image-preview').innerHTML = '<p>Anteprima immagine</p>';
            updateCardPreview();
        }, 10);
    });
    
    // Ricarica carte
    document.getElementById('btn-refresh-cards').addEventListener('click', loadAllCards);
    
    // Cerca carte
    document.getElementById('search-cards').addEventListener('input', filterCards);
    document.getElementById('filter-faction').addEventListener('change', filterCards);
    
    // Modale carta
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-edit').addEventListener('click', editSelectedCard);
    document.getElementById('modal-delete').addEventListener('click', deleteSelectedCard);
}

async function handleFormSubmit(event) {
    event.preventDefault();
    
    const messageEl = document.getElementById('form-message');
    messageEl.className = 'form-message';
    
    // Raccogli dati form
    const cardType = document.getElementById('card-type').value;
    const cardData = {
        name: document.getElementById('card-name').value.trim(),
        faction_id: parseInt(document.getElementById('faction').value),
        card_type: cardType,
        mana_cost: parseInt(document.getElementById('mana-cost').value) || 0,
        attack: ['monster', 'mostrissimo'].includes(cardType) ? (parseInt(document.getElementById('attack').value) || null) : null,
        hp: ['monster', 'mostrissimo'].includes(cardType) ? (parseInt(document.getElementById('hp').value) || null) : null,
        effect_text: document.getElementById('effect-text').value.trim(),
        is_boss: false,
        is_indrazzi: false
    };
    
    // Verifica immagine
    if (!AppState.currentImageFile) {
        showMessage('Devi caricare un\'immagine!', 'error');
        return;
    }
    
    // Genera effect_json
    if (AppState.addedEffects.length > 0) {
        if (AppState.addedEffects.length === 1) {
            cardData.effect_json = AppState.addedEffects[0].json;
        } else {
            cardData.effect_json = {
                effects: AppState.addedEffects.map(e => e.json)
            };
        }
    }
    
    try {
        showMessage('Creazione carta in corso...', 'success');
        
        // 1. Crea la carta (senza image_url)
        const { data: card, error: cardError } = await supabase
            .from('cards')
            .insert([cardData])
            .select()
            .single();
        
        if (cardError) {
            console.error('Errore inserimento carta:', cardError);
            throw cardError;
        }
        
        // 2. Carica immagine
        const factionCodes = ['CHI', 'INF', 'PES', 'BUL', 'GRO', 'CLO', 'IND'];
        const factionCode = factionCodes[cardData.faction_id - 1];
        
        showMessage('Upload immagine...', 'success');
        const imageUrl = await uploadImageToSupabase(card.id, factionCode);
        
        if (!imageUrl) {
            throw new Error('Upload immagine fallito');
        }
        
        // 3. Aggiorna carta con image_url
        const { error: updateError } = await supabase
            .from('cards')
            .update({ image_url: imageUrl })
            .eq('id', card.id);
        
        if (updateError) {
            console.error('Errore aggiornamento image_url:', updateError);
            throw updateError;
        }
        
        showMessage(`✅ Carta "${card.name}" creata con successo! Immagine: WebP compresso.`, 'success');
        
        // Reset form
        document.getElementById('card-form').reset();
        AppState.addedEffects = [];
        AppState.currentImageFile = null;
        AppState.currentImageUrl = null;
        renderEffectsList();
        document.getElementById('image-preview').innerHTML = '<p>Anteprima immagine</p>';
        updateCardPreview();
        
        // Ricarica lista carte
        loadAllCards();
        
    } catch (error) {
        console.error('Errore creazione carta:', error);
        showMessage(`❌ Errore: ${error.message}`, 'error');
    }
}

function showMessage(message, type) {
    const messageEl = document.getElementById('form-message');
    messageEl.textContent = message;
    messageEl.className = `form-message ${type}`;
    
    if (type === 'success') {
        setTimeout(() => {
            messageEl.className = 'form-message';
        }, 5000);
    }
}

// ============================================
// ANTEPRIMA CARTA
// ============================================
function updateCardPreview() {
    const name = document.getElementById('card-name').value || 'Nome Carta';
    const type = document.getElementById('card-type').value || 'Tipo';
    const mana = document.getElementById('mana-cost').value || '0';
    const attack = document.getElementById('attack').value || '0';
    const hp = document.getElementById('hp').value || '0';
    const effect = document.getElementById('effect-text').value || 'Testo effetto...';
    
    document.getElementById('preview-name').textContent = name;
    document.getElementById('preview-type').textContent = type;
    document.getElementById('preview-mana').textContent = `⚡${mana}`;
    document.getElementById('preview-effect').textContent = effect;
    
    // Stats
    const cardType = document.getElementById('card-type').value;
    const atkEl = document.getElementById('preview-atk');
    const hpEl = document.getElementById('preview-hp');
    
    if (['monster', 'mostrissimo'].includes(cardType)) {
        atkEl.style.display = 'inline';
        hpEl.style.display = 'inline';
        atkEl.textContent = `⚔${attack}`;
        hpEl.textContent = `❤${hp}`;
    } else {
        atkEl.style.display = 'none';
        hpEl.style.display = 'none';
    }
    
    // Immagine
    const imageEl = document.getElementById('preview-image');
    if (AppState.currentImageUrl) {
        imageEl.innerHTML = `<img src="${AppState.currentImageUrl}" alt="Anteprima">`;
    } else {
        imageEl.innerHTML = '<span>Immagine</span>';
    }
}

// ============================================
// GESTIONE CARTE ESISTENTI
// ============================================
async function loadAllCards() {
    const grid = document.getElementById('cards-grid');
    grid.innerHTML = '<p>Caricamento...</p>';
    
    try {
        const { data, error } = await supabase
            .from('cards')
            .select(`
                *,
                factions (
                    name,
                    code,
                    color_hex
                )
            `)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Errore caricamento carte:', error);
            grid.innerHTML = `<p>Errore DB: ${error.message}</p>`;
            return;
        }
        
        AppState.allCards = data;
        renderCardsGrid(data);
        
    } catch (err) {
        console.error('Eccezione caricamento carte:', err);
        grid.innerHTML = `<p>Errore: ${err.message}</p>`;
    }
}

function renderCardsGrid(cards) {
    const grid = document.getElementById('cards-grid');
    grid.innerHTML = '';
    
    if (!cards || cards.length === 0) {
        grid.innerHTML = '<p>Nessuna carta trovata</p>';
        return;
    }
    
    cards.forEach(card => {
        const item = document.createElement('div');
        item.className = 'card-item';
        
        const name = document.createElement('div');
        name.className = 'card-name';
        name.textContent = card.name;
        
        const meta = document.createElement('div');
        meta.className = 'card-meta';
        meta.textContent = `${card.factions?.name || '???'} • ${card.card_type} • ⚡${card.mana_cost}`;
        
        item.appendChild(name);
        item.appendChild(meta);
        
        item.addEventListener('click', () => selectCard(card));
        
        grid.appendChild(item);
    });
}

function filterCards() {
    const searchTerm = document.getElementById('search-cards').value.toLowerCase();
    const factionFilter = document.getElementById('filter-faction').value;
    
    let filtered = AppState.allCards;
    
    if (searchTerm) {
        filtered = filtered.filter(card => 
            card.name.toLowerCase().includes(searchTerm) ||
            card.effect_text?.toLowerCase().includes(searchTerm)
        );
    }
    
    if (factionFilter) {
        filtered = filtered.filter(card => card.faction_id === parseInt(factionFilter));
    }
    
    renderCardsGrid(filtered);
}

function selectCard(card) {
    AppState.selectedCardId = card.id;
    
    const modal = document.getElementById('card-modal');
    const title = document.getElementById('modal-title');
    
    title.textContent = card.name;
    modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('card-modal');
    modal.style.display = 'none';
    AppState.selectedCardId = null;
}

async function editSelectedCard() {
    if (!AppState.selectedCardId) return;
    
    const card = AppState.allCards.find(c => c.id === AppState.selectedCardId);
    if (!card) return;
    
    // Carica i dati nel form
    document.getElementById('card-name').value = card.name;
    document.getElementById('card-type').value = card.card_type;
    document.getElementById('faction').value = card.faction_id;
    document.getElementById('mana-cost').value = card.mana_cost;
    document.getElementById('attack').value = card.attack || '';
    document.getElementById('hp').value = card.hp || '';
    document.getElementById('effect-text').value = card.effect_text || '';
    
    // Carica immagine
    if (card.image_url) {
        AppState.currentImageUrl = card.image_url;
        document.getElementById('image-preview').innerHTML = `<img src="${card.image_url}" alt="${card.name}">`;
    }
    
    closeModal();
    
    // Scroll to form
    document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
}

async function deleteSelectedCard() {
    if (!AppState.selectedCardId) return;
    
    const card = AppState.allCards.find(c => c.id === AppState.selectedCardId);
    if (!card) return;
    
    const confirmed = confirm(`Sei sicuro di voler eliminare "${card.name}"?`);
    if (!confirmed) return;
    
    try {
        const { error } = await supabase
            .from('cards')
            .delete()
            .eq('id', AppState.selectedCardId);
        
        if (error) {
            throw error;
        }
        
        alert(`Carta "${card.name}" eliminata!`);
        closeModal();
        loadAllCards();
        
    } catch (error) {
        console.error('Errore eliminazione carta:', error);
        alert(`Errore: ${error.message}`);
    }
}

// ============================================
// FUNZIONI DI SUPPORTO
// ============================================

function getFactionCode(factionId) {
    const codes = ['CHI', 'INF', 'PES', 'BUL', 'GRO', 'CLO', 'IND'];
    return codes[factionId - 1] || 'IND';
}

// ============================================
// EXPORT GLOBALE PER DEBUGGING
// ============================================
window.CardCreator = {
    AppState,
    supabase,
    loadAllCards,
    updateCardPreview,
    addEffectToCard,
    removeEffectFromCard,
    compressImageToWebP,
    resetEffects: function() {
        localStorage.removeItem('bellum_effects');
        location.reload();
    },
    testConnection: async function() {
        const { data, error } = await supabase.from('factions').select('*').limit(1);
        console.log('Test connessione Supabase:', data, error);
        return { data, error };
    }
};

console.log('✅ CardCreator esposto globalmente. Usa window.CardCreator in console.');
console.log('✅ Supabase client:', supabase ? 'OK' : 'NULL');