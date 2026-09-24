import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import {
    getAllEffects,
    generateEffectJSON,
    generateEffectText,
    getEffectConfig,
    addNewEffect,
    deleteEffectById
} from './effects.js';

const SUPABASE_URL = 'https://dgsqxnmrjfvklnjliplh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ZwwwsHnjEWNbe2CnDKsTSA_8ljXZlOG';
const STORAGE_BUCKET = 'card-images';
const CREATURE_TYPES = ['monster', 'mostrissimo'];
const FACTION_CODES = ['CHI', 'INF', 'PES', 'BUL', 'GRO', 'CLO', 'IND'];

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

const $ = (id) => document.getElementById(id);

function isCreatureType(type) {
    return CREATURE_TYPES.includes(type);
}

function getFactionCode(factionId) {
    return FACTION_CODES[Number(factionId) - 1] || 'IND';
}

function showMessage(message, type = 'success') {
    const element = $('form-message');
    if (!element) return;
    element.textContent = message;
    element.className = `form-message ${type}`;
}

function setStatsVisibility(type = $('card-type')?.value || '') {
    const statsRow = $('stats-row');
    if (statsRow) {
        statsRow.style.display = isCreatureType(type) ? 'grid' : 'none';
    }
}

function setImageRequired(required) {
    const imageInput = $('card-image');
    if (imageInput) {
        imageInput.required = required;
    }
}

function getPreviewImageUrl() {
    return AppState.currentImageUrl || AppState.originalImageUrl || null;
}

function populateEffectSelector() {
    const selector = $('effect-type');
    if (!selector) return;

    selector.innerHTML = '<option value="">Seleziona effetto...</option>';

    getAllEffects().forEach((effect) => {
        const option = document.createElement('option');
        option.value = effect.id;
        option.textContent = effect.name;
        option.title = effect.description || '';
        selector.appendChild(option);
    });
}

function renderEffectParams(effectId, values = {}) {
    const container = $('effect-params');
    if (!container) return;

    container.innerHTML = '';
    const effect = getEffectConfig(effectId);

    if (!effect?.params?.length) {
        container.innerHTML = '<p class="form-hint">Nessun parametro per questo effetto.</p>';
        return;
    }

    effect.params.forEach((param) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'effect-param-field';

        const label = document.createElement('label');
        label.htmlFor = `param-${param.name}`;
        label.textContent = param.label;
        wrapper.appendChild(label);

        let input;

        if (param.type === 'select') {
            input = document.createElement('select');
            (param.options || []).forEach((optionData) => {
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
    const effectId = $('effect-type')?.value;
    const config = getEffectConfig(effectId);

    if (!config) {
        alert('Seleziona un effetto.');
        return;
    }

    const params = {};
    (config.params || []).forEach((param) => {
        const input = $(`param-${param.name}`);
        params[param.name] = input?.value ?? param.default;
    });

    const effectJson = generateEffectJSON(effectId, params);
    if (!effectJson) {
        alert('Non è stato possibile generare il JSON dell’effetto.');
        return;
    }

    AppState.addedEffects.push({
        id: config.id,
        name: config.name,
        params,
        json: effectJson,
        text: generateEffectText(effectId, params)
    });

    $('effect-type').value = '';
    $('effect-params').innerHTML = '';
    renderCardEffects();
}

function renderCardEffects() {
    const container = $('effects-list');
    if (!container) return;

    container.innerHTML = '';

    if (!AppState.addedEffects.length) {
        container.innerHTML = '<p class="no-effects">Nessun effetto aggiunto. Seleziona dalla lista in basso.</p>';
        return;
    }

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
        details.textContent = effect.text || JSON.stringify(effect.json);

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'btn-remove';
        removeButton.textContent = 'Rimuovi';
        removeButton.addEventListener('click', () => {
            AppState.addedEffects.splice(index, 1);
            renderCardEffects();
            updatePreview();
        });

        info.append(name, details);
        item.append(info, removeButton);
        container.appendChild(item);
    });
}

function renderEffectsManagementList() {
    const container = $('effects-list-container');
    if (!container) return;

    container.innerHTML = '';
    const effects = getAllEffects();

    if (!effects.length) {
        container.innerHTML = '<p class="no-effects">Nessun effetto presente.</p>';
        return;
    }

    effects.forEach((effect) => {
        const card = document.createElement('div');
        card.className = 'effect-card';

        const header = document.createElement('div');
        header.className = 'effect-card-header';

        const title = document.createElement('span');
        title.className = 'effect-card-title';
        title.textContent = effect.name;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn-view';
        button.textContent = 'Vedi';
        button.addEventListener('click', () => viewEffect(effect.id));

        const body = document.createElement('div');
        body.className = 'effect-card-body';
        body.textContent = effect.description || effect.id;

        header.append(title, button);
        card.append(header, body);
        container.appendChild(card);
    });
}

function initializeEffects() {
    populateEffectSelector();
    renderEffectsManagementList();

    $('effect-type')?.addEventListener('change', (event) => {
        renderEffectParams(event.target.value);
    });

    $('btn-add-effect')?.addEventListener('click', addEffectToCard);

    $('effect-form')?.addEventListener('submit', (event) => {
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

    $('effect-modal-close')?.addEventListener('click', closeEffectModal);
    $('effect-modal-delete')?.addEventListener('click', deleteSelectedEffect);
}

function viewEffect(effectId) {
    const effect = getEffectConfig(effectId);
    if (!effect) return;

    AppState.selectedEffectId = effectId;
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
    if (!effect || !confirm(`Eliminare definitivamente l’effetto "${effect.name}"?`)) return;

    deleteEffectById(AppState.selectedEffectId);
    closeEffectModal();
    populateEffectSelector();
    renderEffectsManagementList();
}

function readBlobAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Impossibile leggere l’immagine.'));
        reader.readAsDataURL(blob);
    });
}

function compressImageToWebP(file, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            const image = new Image();

            image.onload = () => {
                const maximumSize = 800;
                const scale = Math.min(1, maximumSize / Math.max(image.width, image.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(image.width * scale));
                canvas.height = Math.max(1, Math.round(image.height * scale));
                canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);

                canvas.toBlob(
                    (blob) => blob ? resolve(blob) : reject(new Error('Conversione WebP fallita.')),
                    'image/webp',
                    quality
                );
            };

            image.onerror = () => reject(new Error('Immagine non leggibile.'));
            image.src = event.target.result;
        };

        reader.onerror = () => reject(new Error('Lettura dell’immagine fallita.'));
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
        $('image-preview').innerHTML = `<img src="${AppState.currentImageUrl}" alt="Anteprima immagine selezionata">`;
        updatePreview();
        showMessage('Nuova immagine pronta: verrà salvata come WebP.', 'success');
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

    $('card-image').value = '';
    $('image-preview').innerHTML = '<p>Anteprima immagine</p>';
    setImageRequired(true);
    renderCardEffects();
    updatePreview();
}

function fillEffectsFromJson(effectJson) {
    AppState.addedEffects = [];
    if (!effectJson) {
        renderCardEffects();
        return;
    }

    const rawEffects = Array.isArray(effectJson.effects) ? effectJson.effects : [effectJson];

    rawEffects.forEach((json) => {
        if (!json?.type) return;

        const config = getEffectConfig(json.type);
        if (!config) return;

        const params = {};
        (config.params || []).forEach((param) => {
            if (json[param.name] !== undefined) {
                params[param.name] = String(json[param.name]);
            }
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

    const path = `${getFactionCode(factionId)}/${cardId}.webp`;
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, AppState.currentImageFile, {
        upsert: true,
        contentType: 'image/webp',
        cacheControl: '3600'
    });

    if (error) throw error;

    return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

function collectCardData() {
    const type = $('card-type').value;
    const effectText = $('effect-text').value.trim() || AppState.addedEffects.map((effect) => effect.text).filter(Boolean).join('. ');

    return {
        name: $('card-name').value.trim(),
        faction_id: Number($('faction').value),
        card_type: type,
        mana_cost: Number($('mana-cost').value || 0),
        attack: isCreatureType(type) ? Number($('attack').value || 0) : null,
        hp: isCreatureType(type) ? Number($('hp').value || 0) : null,
        effect_text: effectText,
        effect_json: AppState.addedEffects.length === 1
            ? AppState.addedEffects[0].json
            : AppState.addedEffects.length > 1
                ? { effects: AppState.addedEffects.map((effect) => effect.json) }
                : null
    };
}

function findDuplicate(cardData, excludedId = null) {
    return AppState.allCards.find((card) => (
        card.name === cardData.name &&
        card.faction_id === cardData.faction_id &&
        card.id !== excludedId
    )) || null;
}

async function saveCard(event) {
    event.preventDefault();

    const cardData = collectCardData();
    const hasExistingImage = Boolean(AppState.originalImageUrl);
    const hasNewImage = AppState.currentImageFile instanceof Blob;

    if (!cardData.name || !cardData.faction_id || !cardData.card_type) {
        showMessage('Compila nome, fazione e tipo della carta.', 'error');
        return;
    }

    if (!AppState.isEditing && !hasNewImage) {
        showMessage('Seleziona un file immagine prima di salvare una nuova carta.', 'error');
        return;
    }

    if (AppState.isEditing && !hasExistingImage && !hasNewImage) {
        showMessage('Questa carta non ha un’immagine salvata: seleziona un file.', 'error');
        return;
    }

    try {
        const duplicate = findDuplicate(cardData, AppState.isEditing ? AppState.editingCardId : null);

        if (duplicate) {
            const confirmed = confirm(
                `Esiste già la carta "${duplicate.name}" nella stessa fazione.\n\n` +
                'Vuoi sovrascriverla definitivamente? La carta esistente andrà persa.'
            );

            if (!confirmed) return;

            const { error: deleteError } = await supabase.from('cards').delete().eq('id', duplicate.id);
            if (deleteError) throw deleteError;
        }

        let savedCard;

        if (AppState.isEditing) {
            showMessage('Aggiornamento carta in corso...', 'success');
            const { data, error } = await supabase
                .from('cards')
                .update(cardData)
                .eq('id', AppState.editingCardId)
                .select()
                .single();

            if (error) throw error;
            savedCard = data;
        } else {
            showMessage('Creazione carta in corso...', 'success');
            const { data, error } = await supabase
                .from('cards')
                .insert(cardData)
                .select()
                .single();

            if (error) throw error;
            savedCard = data;
        }

        if (hasNewImage) {
            showMessage('Upload immagine WebP in corso...', 'success');
            const imageUrl = await uploadImage(savedCard.id, cardData.faction_id);
            const { error: imageUrlError } = await supabase
                .from('cards')
                .update({ image_url: imageUrl })
                .eq('id', savedCard.id);

            if (imageUrlError) throw imageUrlError;
        }

        showMessage(`✅ Carta "${savedCard.name}" salvata correttamente.`, 'success');
        $('card-form').reset();
        resetEditorState();
        await loadAllCards();
    } catch (error) {
        console.error('Errore salvataggio carta:', error);
        showMessage(`❌ Errore: ${error.message}`, 'error');
    }
}

async function loadAllCards() {
    const grid = $('cards-grid');
    if (grid) grid.innerHTML = '<p>Caricamento...</p>';

    const { data, error } = await supabase
        .from('cards')
        .select('*, factions(name, code, color_hex)')
        .order('created_at', { ascending: false });

    if (error) {
        if (grid) grid.innerHTML = `<p>Errore database: ${error.message}</p>`;
        return;
    }

    AppState.allCards = data || [];
    renderCardsGrid(AppState.allCards);
}

function renderCardsGrid(cards) {
    const grid = $('cards-grid');
    if (!grid) return;

    grid.innerHTML = cards.length ? '' : '<p>Nessuna carta trovata.</p>';

    cards.forEach((card) => {
        const item = document.createElement('div');
        item.className = 'card-item';

        const name = document.createElement('div');
        name.className = 'card-name';
        name.textContent = card.name;

        const meta = document.createElement('div');
        meta.className = 'card-meta';
        meta.textContent = `${card.factions?.name || '???'} • ${card.card_type} • ⚡${card.mana_cost}`;

        item.append(name, meta);
        item.addEventListener('click', () => selectCard(card));
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
    const card = AppState.allCards.find((item) => item.id === AppState.selectedCardId);
    if (!card) return;

    AppState.isEditing = true;
    AppState.editingCardId = card.id;
    AppState.currentImageFile = null;
    AppState.originalImageUrl = card.image_url || null;
    AppState.currentImageUrl = card.image_url || null;

    $('card-name').value = card.name || '';
    $('card-type').value = card.card_type || '';
    $('faction').value = card.faction_id || '';
    $('mana-cost').value = card.mana_cost ?? 0;
    $('attack').value = card.attack ?? '';
    $('hp').value = card.hp ?? '';
    $('effect-text').value = card.effect_text || '';
    $('card-image').value = '';

    setStatsVisibility(card.card_type);
    setImageRequired(!AppState.originalImageUrl);

    $('image-preview').innerHTML = AppState.originalImageUrl
        ? `<img src="${AppState.originalImageUrl}" alt="${card.name}">`
        : '<p>Nessuna immagine salvata: seleziona un file.</p>';

    fillEffectsFromJson(card.effect_json);
    closeCardModal();
    updatePreview();

    const formSection = document.querySelector('.form-section');
    if (formSection) {
        formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    showMessage('📝 Modalità modifica attiva. La foto esistente verrà mantenuta se non ne scegli una nuova.', 'success');
}

async function deleteSelectedCard() {
    const card = AppState.allCards.find((item) => item.id === AppState.selectedCardId);
    if (!card || !confirm(`Eliminare definitivamente "${card.name}"?`)) return;

    const { error } = await supabase.from('cards').delete().eq('id', card.id);

    if (error) {
        alert(`Errore: ${error.message}`);
        return;
    }

    closeCardModal();
    await loadAllCards();
}

function updatePreview() {
    $('preview-name').textContent = $('card-name').value || 'Nome Carta';
    $('preview-type').textContent = $('card-type').value || 'Tipo';
    $('preview-mana').textContent = `⚡${$('mana-cost').value || 0}`;

    const generatedEffectText = AppState.addedEffects.map((effect) => effect.text).filter(Boolean).join('. ');
    $('preview-effect').textContent = $('effect-text').value || generatedEffectText || 'Testo effetto...';

    const creature = isCreatureType($('card-type').value);
    $('preview-atk').style.display = creature ? 'inline' : 'none';
    $('preview-hp').style.display = creature ? 'inline' : 'none';
    $('preview-atk').textContent = `⚔${$('attack').value || 0}`;
    $('preview-hp').textContent = `❤${$('hp').value || 0}`;

    const imageUrl = getPreviewImageUrl();
    $('preview-image').innerHTML = imageUrl
        ? `<img src="${imageUrl}" alt="Anteprima carta">`
        : '<span>Immagine</span>';
}

function filterCards() {
    const search = $('search-cards').value.toLowerCase();
    const factionId = $('filter-faction').value;

    const filtered = AppState.allCards.filter((card) => {
        const matchesSearch = !search || card.name.toLowerCase().includes(search) || (card.effect_text || '').toLowerCase().includes(search);
        const matchesFaction = !factionId || card.faction_id === Number(factionId);
        return matchesSearch && matchesFaction;
    });

    renderCardsGrid(filtered);
}

function bindEvents() {
    $('card-image')?.addEventListener('change', handleImageChange);

    $('card-type')?.addEventListener('change', (event) => {
        setStatsVisibility(event.target.value);
        updatePreview();
    });

    ['card-name', 'faction', 'mana-cost', 'attack', 'hp', 'effect-text'].forEach((id) => {
        $(id)?.addEventListener('input', updatePreview);
    });

    $('card-form')?.addEventListener('submit', saveCard);

    $('btn-preview')?.addEventListener('click', (event) => {
        event.preventDefault();
        updatePreview();
        document.querySelector('.preview-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    $('card-form')?.addEventListener('reset', () => {
        setTimeout(resetEditorState, 0);
    });

    $('btn-refresh-cards')?.addEventListener('click', loadAllCards);
    $('search-cards')?.addEventListener('input', filterCards);
    $('filter-faction')?.addEventListener('change', filterCards);
    $('modal-close')?.addEventListener('click', closeCardModal);
    $('modal-edit')?.addEventListener('click', editSelectedCard);
    $('modal-delete')?.addEventListener('click', deleteSelectedCard);
}

window.CardCreator = {
    AppState,
    supabase,
    loadAllCards,
    updatePreview,
    resetEffects: () => {
        localStorage.removeItem('bellum_effects');
        location.reload();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initializeEffects();
    bindEvents();
    setStatsVisibility();
    setImageRequired(true);
    renderCardEffects();
    updatePreview();
    loadAllCards();
});