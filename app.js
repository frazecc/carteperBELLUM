import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { getAllEffects, generateEffectJSON, generateEffectText, getEffectConfig, addNewEffect, deleteEffectById } from './effects.js';

const SUPABASE_URL = 'https://dgsqxnmrjfvklnjliplh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ZwwwsHnjEWNbe2CnDKsTSA_8ljXZlOG';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BUCKET = 'card-images';

const AppState = {
    currentImageFile: null,
    currentImageUrl: null,
    originalImageUrl: null,
    addedEffects: [],
    allCards: [],
    selectedCardId: null,
    selectedEffectId: null,
    isEditing: false,
    editingCardId: null
};

const $ = id => document.getElementById(id);
const CREATURE_TYPES = ['monster', 'mostrissimo'];
const FACTION_CODES = ['CHI', 'INF', 'PES', 'BUL', 'GRO', 'CLO', 'IND'];

function setStatsVisibility(type = $('card-type').value) {
    $('stats-row').style.display = CREATURE_TYPES.includes(type) ? 'grid' : 'none';
}

function populateEffectSelector() {
    const select = $('effect-type');
    select.innerHTML = '<option value="">Seleziona effetto...</option>';
    getAllEffects().forEach(effect => {
        const option = document.createElement('option');
        option.value = effect.id;
        option.textContent = effect.name;
        option.title = effect.description || '';
        select.appendChild(option);
    });
}

function renderEffectParams(effectId, values = {}) {
    const container = $('effect-params');
    container.innerHTML = '';
    const effect = getEffectConfig(effectId);
    if (!effect?.params?.length) {
        container.innerHTML = '<p class="form-hint">Nessun parametro per questo effetto.</p>';
        return;
    }
    effect.params.forEach(param => {
        const wrapper = document.createElement('div');
        const label = document.createElement('label');
        label.textContent = param.label;
        wrapper.appendChild(label);
        let input;
        if (param.type === 'select') {
            input = document.createElement('select');
            (param.options || []).forEach(optionData => {
                const option = document.createElement('option');
                option.value = optionData.value;
                option.textContent = optionData.label;
                input.appendChild(option);
            });
        } else {
            input = document.createElement('input');
            input.type = 'number';
            input.min = param.min ?? 0;
            input.max = param.max ?? 99;
        }
        input.id = `param-${param.name}`;
        input.value = values[param.name] ?? param.default ?? 1;
        wrapper.appendChild(input);
        container.appendChild(wrapper);
    });
}

function addEffectToCard() {
    const effectId = $('effect-type').value;
    const config = getEffectConfig(effectId);
    if (!config) return alert('Seleziona un effetto.');
    const params = {};
    (config.params || []).forEach(param => {
        params[param.name] = $(`param-${param.name}`)?.value ?? param.default;
    });
    const json = generateEffectJSON(effectId, params);
    if (!json) return alert('Impossibile generare l’effetto.');
    AppState.addedEffects.push({
        id: effectId,
        name: config.name,
        params,
        json,
        text: generateEffectText(effectId, params)
    });
    renderCardEffects();
    $('effect-type').value = '';
    $('effect-params').innerHTML = '';
}

function renderCardEffects() {
    const container = $('effects-list');
    container.innerHTML = '';
    if (!AppState.addedEffects.length) {
        container.innerHTML = '<p class="no-effects">Nessun effetto aggiunto. Seleziona dalla lista in basso.</p>';
        return;
    }
    AppState.addedEffects.forEach((effect, index) => {
        const item = document.createElement('div');
        item.className = 'effect-item';
        item.innerHTML = `<div class="effect-info"><div class="effect-name"></div><div class="effect-details"></div></div>`;
        item.querySelector('.effect-name').textContent = effect.name;
        item.querySelector('.effect-details').textContent = effect.text || JSON.stringify(effect.json);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn-remove';
        remove.textContent = 'Rimuovi';
        remove.onclick = () => {
            AppState.addedEffects.splice(index, 1);
            renderCardEffects();
            updatePreview();
        };
        item.appendChild(remove);
        container.appendChild(item);
    });
    if (!$('effect-text').value.trim()) {
        $('effect-text').value = AppState.addedEffects.map(effect => effect.text).filter(Boolean).join('. ');
    }
    updatePreview();
}

function renderEffectsManagementList() {
    const container = $('effects-list-container');
    container.innerHTML = '';
    const effects = getAllEffects();
    if (!effects.length) {
        container.innerHTML = '<p class="no-effects">Nessun effetto presente.</p>';
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
        const view = document.createElement('button');
        view.type = 'button';
        view.className = 'btn-view';
        view.textContent = 'Vedi';
        view.onclick = () => viewEffect(effect.id);
        header.append(title, view);
        const body = document.createElement('div');
        body.className = 'effect-card-body';
        body.textContent = effect.description || effect.id;
        card.append(header, body);
        container.appendChild(card);
    });
}

function initializeEffects() {
    populateEffectSelector();
    renderEffectsManagementList();
    $('effect-type').addEventListener('change', event => renderEffectParams(event.target.value));
    $('btn-add-effect').addEventListener('click', addEffectToCard);
    $('effect-form').addEventListener('submit', event => {
        event.preventDefault();
        const effect = {
            id: $('effect-id').value.trim(),
            name: $('effect-name').value.trim(),
            description: $('effect-description').value.trim(),
            params: [],
            generateJSON: $('effect-generate-json').value.trim(),
            generateText: $('effect-generate-text').value.trim()
        };
        try {
            addNewEffect(effect);
            $('effect-form').reset();
            populateEffectSelector();
            renderEffectsManagementList();
            alert(`Effetto "${effect.name}" creato con successo.`);
        } catch (error) {
            alert(`Errore: ${error.message}`);
        }
    });
    $('effect-modal-close').addEventListener('click', closeEffectModal);
    $('effect-modal-delete').addEventListener('click', deleteSelectedEffect);
}

function viewEffect(id) {
    AppState.selectedEffectId = id;
    const effect = getEffectConfig(id);
    if (!effect) return;
    $('effect-modal-title').textContent = `${effect.name} (${effect.id})`;
    $('effect-modal').style.display = 'flex';
}

function closeEffectModal() {
    $('effect-modal').style.display = 'none';
    AppState.selectedEffectId = null;
}

function deleteSelectedEffect() {
    if (!AppState.selectedEffectId) return;
    const effect = getEffectConfig(AppState.selectedEffectId);
    if (!effect || !confirm(`Eliminare "${effect.name}"?`)) return;
    deleteEffectById(AppState.selectedEffectId);
    closeEffectModal();
    populateEffectSelector();
    renderEffectsManagementList();
}

function readBlobAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function compressImageToWebP(file, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = event => {
            const image = new Image();
            image.onload = () => {
                const maxSize = 800;
                const ratio = Math.min(1, maxSize / Math.max(image.width, image.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(image.width * ratio));
                canvas.height = Math.max(1, Math.round(image.height * ratio));
                canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Conversione WebP fallita')), 'image/webp', quality);
            };
            image.onerror = () => reject(new Error('Immagine non leggibile'));
            image.src = event.target.result;
        };
        reader.onerror = () => reject(new Error('Lettura immagine fallita'));
        reader.readAsDataURL(file);
    });
}

async function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
        showMessage('Compressione immagine in corso...', 'success');
        AppState.currentImageFile = await compressImageToWebP(file);
        AppState.currentImageUrl = await readBlobAsDataUrl(AppState.currentImageFile);
        $('image-preview').innerHTML = `<img src="${AppState.currentImageUrl}" alt="Anteprima">`;
        updatePreview();
        showMessage('Immagine pronta: verrà salvata come WebP.', 'success');
    } catch (error) {
        AppState.currentImageFile = null;
        $('card-image').value = '';
        showMessage(`Errore immagine: ${error.message}`, 'error');
    }
}

function resetEditorState() {
    AppState.currentImageFile = null;
    AppState.currentImageUrl = null;
    AppState.originalImageUrl = null;
    AppState.addedEffects = [];
    AppState.isEditing = false;
    AppState.editingCardId = null;
    renderCardEffects();
    $('image-preview').innerHTML = '<p>Anteprima immagine</p>';
    $('card-image').value = '';
    updatePreview();
}

function fillEffectsFromJson(effectJson) {
    AppState.addedEffects = [];
    if (!effectJson) return;
    const rawEffects = Array.isArray(effectJson.effects) ? effectJson.effects : [effectJson];
    rawEffects.forEach(json => {
        if (!json?.type) return;
        const config = getEffectConfig(json.type);
        if (!config) return;
        const params = {};
        (config.params || []).forEach(param => {
            if (json[param.name] !== undefined) params[param.name] = String(json[param.name]);
        });
        AppState.addedEffects.push({
            id: config.id,
            name: config.name,
            params,
            json,
            text: generateEffectText(config.id, { ...json, ...params })
        });
    });
    renderCardEffects();
}

async function uploadImage(cardId, factionId) {
    if (!(AppState.currentImageFile instanceof Blob)) return null;
    const path = `${FACTION_CODES[factionId - 1] || 'IND'}/${cardId}.webp`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, AppState.currentImageFile, {
        upsert: true,
        contentType: 'image/webp',
        cacheControl: '3600'
    });
    if (error) throw error;
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function collectCardData() {
    const type = $('card-type').value;
    const data = {
        name: $('card-name').value.trim(),
        faction_id: Number($('faction').value),
        card_type: type,
        mana_cost: Number($('mana-cost').value || 0),
        attack: CREATURE_TYPES.includes(type) ? Number($('attack').value || 0) : null,
        hp: CREATURE_TYPES.includes(type) ? Number($('hp').value || 0) : null,
        effect_text: $('effect-text').value.trim() || AppState.addedEffects.map(e => e.text).filter(Boolean).join('. '),
        effect_json: AppState.addedEffects.length === 1 ? AppState.addedEffects[0].json : AppState.addedEffects.length > 1 ? { effects: AppState.addedEffects.map(e => e.json) } : null
    };
    return data;
}

async function findDuplicate(cardData, excludedId = null) {
    return AppState.allCards.find(card => card.name === cardData.name && card.faction_id === cardData.faction_id && card.id !== excludedId) || null;
}

async function saveCard(event) {
    event.preventDefault();
    const cardData = collectCardData();
    if (!cardData.name || !cardData.faction_id || !cardData.card_type) return showMessage('Compila nome, fazione e tipo.', 'error');
    if (!AppState.isEditing && !(AppState.currentImageFile instanceof Blob)) return showMessage('Seleziona un file immagine prima di salvare.', 'error');
    try {
        const duplicate = await findDuplicate(cardData, AppState.isEditing ? AppState.editingCardId : null);
        if (duplicate) {
            const ok = confirm(`Esiste già "${duplicate.name}" nella stessa fazione. Vuoi sovrascriverla definitivamente?`);
            if (!ok) return;
            const { error } = await supabase.from('cards').delete().eq('id', duplicate.id);
            if (error) throw error;
        }
        let card;
        if (AppState.isEditing) {
            const { data, error } = await supabase.from('cards').update(cardData).eq('id', AppState.editingCardId).select().single();
            if (error) throw error;
            card = data;
        } else {
            const { data, error } = await supabase.from('cards').insert(cardData).select().single();
            if (error) throw error;
            card = data;
        }
        if (AppState.currentImageFile instanceof Blob) {
            showMessage('Carta salvata. Upload immagine WebP in corso...', 'success');
            const imageUrl = await uploadImage(card.id, cardData.faction_id);
            const { error } = await supabase.from('cards').update({ image_url: imageUrl }).eq('id', card.id);
            if (error) throw error;
        }
        showMessage(`✅ Carta "${card.name}" salvata correttamente.`, 'success');
        resetEditorState();
        await loadAllCards();
    } catch (error) {
        console.error(error);
        showMessage(`❌ Errore: ${error.message}`, 'error');
    }
}

async function loadAllCards() {
    const { data, error } = await supabase.from('cards').select('*, factions(name, code, color_hex)').order('created_at', { ascending: false });
    if (error) {
        $('cards-grid').innerHTML = `<p>Errore DB: ${error.message}</p>`;
        return;
    }
    AppState.allCards = data || [];
    renderCardsGrid(AppState.allCards);
}

function renderCardsGrid(cards) {
    const grid = $('cards-grid');
    grid.innerHTML = cards.length ? '' : '<p>Nessuna carta trovata.</p>';
    cards.forEach(card => {
        const item = document.createElement('div');
        item.className = 'card-item';
        item.innerHTML = `<div class="card-name"></div><div class="card-meta"></div>`;
        item.querySelector('.card-name').textContent = card.name;
        item.querySelector('.card-meta').textContent = `${card.factions?.name || '???'} • ${card.card_type} • ⚡${card.mana_cost}`;
        item.onclick = () => selectCard(card);
        grid.appendChild(item);
    });
}

function selectCard(card) {
    AppState.selectedCardId = card.id;
    $('modal-title').textContent = card.name;
    $('card-modal').style.display = 'flex';
}

function closeCardModal() {
    $('card-modal').style.display = 'none';
    AppState.selectedCardId = null;
}

function editSelectedCard() {
    const card = AppState.allCards.find(item => item.id === AppState.selectedCardId);
    if (!card) return;
    AppState.isEditing = true;
    AppState.editingCardId = card.id;
    $('card-name').value = card.name || '';
    $('card-type').value = card.card_type || '';
    $('faction').value = card.faction_id || '';
    $('mana-cost').value = card.mana_cost ?? 0;
    $('attack').value = card.attack ?? '';
    $('hp').value = card.hp ?? '';
    $('effect-text').value = card.effect_text || '';
    setStatsVisibility(card.card_type);
    AppState.originalImageUrl = card.image_url || null;
    AppState.currentImageUrl = card.image_url || null;
    AppState.currentImageFile = null;
    $('image-preview').innerHTML = card.image_url ? `<img src="${card.image_url}" alt="${card.name}">` : '<p>Nessuna immagine salvata</p>';
    fillEffectsFromJson(card.effect_json);
    closeCardModal();
    $('form-section').scrollIntoView?.({ behavior: 'smooth' });
    updatePreview();
    showMessage('Modalità modifica attiva. Sostituisci l’immagine solo se necessario, poi salva.', 'success');
}

async function deleteSelectedCard() {
    const id = AppState.selectedCardId;
    const card = AppState.allCards.find(item => item.id === id);
    if (!card || !confirm(`Eliminare definitivamente "${card.name}"?`)) return;
    const { error } = await supabase.from('cards').delete().eq('id', id);
    if (error) return alert(`Errore: ${error.message}`);
    closeCardModal();
    loadAllCards();
}

function updatePreview() {
    $('preview-name').textContent = $('card-name').value || 'Nome Carta';
    $('preview-type').textContent = $('card-type').value || 'Tipo';
    $('preview-mana').textContent = `⚡${$('mana-cost').value || 0}`;
    $('preview-effect').textContent = $('effect-text').value || AppState.addedEffects.map(e => e.text).filter(Boolean).join('. ') || 'Testo effetto...';
    const creature = CREATURE_TYPES.includes($('card-type').value);
    $('preview-atk').style.display = creature ? 'inline' : 'none';
    $('preview-hp').style.display = creature ? 'inline' : 'none';
    $('preview-atk').textContent = `⚔${$('attack').value || 0}`;
    $('preview-hp').textContent = `❤${$('hp').value || 0}`;
    $('preview-image').innerHTML = AppState.currentImageUrl ? `<img src="${AppState.currentImageUrl}" alt="Anteprima">` : '<span>Immagine</span>';
}

function showMessage(text, type) {
    const element = $('form-message');
    element.textContent = text;
    element.className = `form-message ${type}`;
}

function filterCards() {
    const search = $('search-cards').value.toLowerCase();
    const faction = $('filter-faction').value;
    renderCardsGrid(AppState.allCards.filter(card => (!search || card.name.toLowerCase().includes(search) || (card.effect_text || '').toLowerCase().includes(search)) && (!faction || card.faction_id === Number(faction))));
}

function bindEvents() {
    $('card-image').addEventListener('change', handleImageChange);
    $('card-type').addEventListener('change', event => { setStatsVisibility(event.target.value); updatePreview(); });
    ['card-name', 'faction', 'mana-cost', 'attack', 'hp', 'effect-text'].forEach(id => $(id).addEventListener('input', updatePreview));
    $('card-form').addEventListener('submit', saveCard);
    $('btn-preview').addEventListener('click', event => { event.preventDefault(); updatePreview(); document.querySelector('.preview-section')?.scrollIntoView({ behavior: 'smooth' }); });
    $('card-form').addEventListener('reset', () => setTimeout(resetEditorState, 0));
    $('btn-refresh-cards').addEventListener('click', loadAllCards);
    $('search-cards').addEventListener('input', filterCards);
    $('filter-faction').addEventListener('change', filterCards);
    $('modal-close').addEventListener('click', closeCardModal);
    $('modal-edit').addEventListener('click', editSelectedCard);
    $('modal-delete').addEventListener('click', deleteSelectedCard);
}

window.CardCreator = { AppState, supabase, loadAllCards, updatePreview, resetEffects: () => { localStorage.removeItem('bellum_effects'); location.reload(); } };

document.addEventListener('DOMContentLoaded', () => {
    initializeEffects();
    bindEvents();
    setStatsVisibility();
    renderCardEffects();
    loadAllCards();
});