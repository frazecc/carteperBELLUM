import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import {
    getAllEffects,
    getEffectConfig,
    addNewEffect,
    deleteEffectById
} from './effects.js';

const SUPABASE_URL = 'https://dgsqxnmrjfvklnjliplh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ZwwwsHnjEWNbe2CnDKsTSA_8ljXZlOG';
const STORAGE_BUCKET = 'card-images';
const CREATURE_TYPES = ['monster', 'mostrissimo'];
const FACTION_CODES = ['CHI', 'INF', 'PES', 'BUL', 'GRO', 'CLO', 'IND'];
const RARITY_LABELS = {
    common: 'Comune',
    uncommon: 'Non comune',
    rare: 'Rara',
    indrazzi: 'Indrazzi'
};
const CARD_TYPE_LABELS = {
    monster: 'MOSTRO',
    mostrissimo: 'MOSTRISSIMO',
    sorcery: 'STREGONERIA',
    instant: 'ISTANTANEO',
    terraforma: 'TERRAFORMA',
    aura: 'AURA'
};

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

function getFactionClass(factionId) {
    return `faction-${getFactionCode(factionId).toLowerCase()}`;
}

function getCardTypeLabel(type) {
    return CARD_TYPE_LABELS[type] || String(type || 'TIPO').toUpperCase();
}

function getRarityLabel(rarity) {
    return RARITY_LABELS[rarity] || 'Comune';
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

function setMostrissimoFields(type = $('card-type')?.value || '') {
    const isMostrissimo = type === 'mostrissimo';
    const manaGroup = $('mana-group');
    const sacrificeGroup = $('sacrifice-group');
    const manaInput = $('mana-cost');
    const sacrificeInput = $('sacrifice-cost');

    if (manaGroup) manaGroup.style.display = isMostrissimo ? 'none' : 'block';
    if (sacrificeGroup) sacrificeGroup.style.display = isMostrissimo ? 'block' : 'none';
    if (manaInput) manaInput.required = !isMostrissimo;
    if (sacrificeInput) sacrificeInput.required = isMostrissimo;
}

function synchronizeIndrazziRarity() {
    const factionId = Number($('faction')?.value);
    const rarity = $('rarity');
    if (!rarity) return;

    if (factionId === 7) {
        rarity.value = 'indrazzi';
        rarity.disabled = true;
    } else {
        if (rarity.value === 'indrazzi') rarity.value = 'rare';
        rarity.disabled = false;
    }
}

function setImageRequired(required) {
    const imageInput = $('card-image');
    if (imageInput) imageInput.required = required;
}

function getPreviewImageUrl() {
    return AppState.currentImageUrl || AppState.originalImageUrl || null;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatRulesText(value) {
    const escaped = escapeHtml(value || 'Testo effetto...');
    return escaped
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
}

function applyFactionClasses(cardElement, factionId) {
    if (!cardElement) return;
    cardElement.classList.remove(
        'faction-none',
        'faction-chi',
        'faction-inf',
        'faction-pes',
        'faction-bul',
        'faction-gro',
        'faction-clo',
        'faction-ind'
    );
    cardElement.classList.add(getFactionClass(factionId));
}

function executeEffectFunction(code, params, label) {
    if (typeof code !== 'string' || !code.trim()) {
        throw new Error(`${label} non è definita per questo effetto.`);
    }

    try {
        const factory = new Function('params', `return (${code})(params);`);
        return factory(params);
    } catch (error) {
        console.error(`Errore esecuzione ${label}:`, error, code, params);
        throw new Error(`${label} non può essere eseguita: ${error.message}`);
    }
}

function buildStoredEffect(effectId, params = {}) {
    const config = getEffectConfig(effectId);
    if (!config) throw new Error(`Configurazione non trovata per l'effetto "${effectId}".`);

    const runtimeEffect = executeEffectFunction(config.generateJSON, params, 'generateJSON');

    if (!runtimeEffect || typeof runtimeEffect !== 'object' || Array.isArray(runtimeEffect)) {
        throw new Error(`L'effetto "${effectId}" non ha generato un JSON valido.`);
    }

    return {
        effect_id: effectId,
        ...runtimeEffect
    };
}

function buildEffectText(effectId, params, storedEffect) {
    const config = getEffectConfig(effectId);
    if (!config) return JSON.stringify(storedEffect);

    try {
        const generated = executeEffectFunction(
            config.generateText,
            { ...storedEffect, ...params },
            'generateText'
        );

        return typeof generated === 'string' && generated.trim()
            ? generated
            : JSON.stringify(storedEffect);
    } catch (error) {
        console.warn('Impossibile generare testo effetto:', error);
        return JSON.stringify(storedEffect);
    }
}

function resolveEffectConfig(storedEffect) {
    if (!storedEffect || typeof storedEffect !== 'object') return null;

    if (storedEffect.effect_id) {
        const directMatch = getEffectConfig(storedEffect.effect_id);
        if (directMatch) return directMatch;
    }

    const allEffects = getAllEffects();
    const idMatch = allEffects.find((effect) => effect.id === storedEffect.type);
    if (idMatch) return idMatch;

    return allEffects.find((effect) => {
        try {
            const params = {};
            (effect.params || []).forEach((param) => {
                params[param.name] = storedEffect[param.name] ?? param.default;
            });
            const generated = executeEffectFunction(effect.generateJSON, params, 'generateJSON');
            return generated?.type === storedEffect.type;
        } catch {
            return false;
        }
    }) || null;
}

function getParamsForEditor(config, storedEffect) {
    const params = {};

    (config.params || []).forEach((param) => {
        if (storedEffect[param.name] !== undefined && storedEffect[param.name] !== null) {
            params[param.name] = String(storedEffect[param.name]);
        } else {
            params[param.name] = String(param.default ?? '');
        }
    });

    return params;
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
        params[param.name] = $(`param-${param.name}`)?.value ?? param.default;
    });

    try {
        const storedEffect = buildStoredEffect(effectId, params);
        const text = buildEffectText(effectId, params, storedEffect);

        AppState.addedEffects.push({
            id: config.id,
            name: config.name,
            params,
            json: storedEffect,
            text
        });

        $('effect-type').value = '';
        $('effect-params').innerHTML = '';
        renderCardEffects();
        updatePreview();
    } catch (error) {
        console.error('Errore aggiunta effetto:', error);
        alert(`Errore nell'aggiunta dell'effetto: ${error.message}`);
    }
}

function renderCardEffects() {
    const container = $('effects-list');
    if (!container) return;

    container.innerHTML = '';

    if (!AppState.addedEffects.length) {
        container.innerHTML = '<p class="no-effects">Nessun effetto aggiunto. Seleziona un effetto dal menu.</p>';
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

    $('editor-title').textContent = 'Nuova Carta';
    $('btn-save-card').textContent = '💾 Salva Carta';
    $('card-image').value = '';
    $('image-preview').innerHTML = '<p>Anteprima immagine</p>';
    setImageRequired(true);
    setStatsVisibility();
    setMostrissimoFields();
    synchronizeIndrazziRarity();
    renderCardEffects();
    updatePreview();
}

function fillEffectsFromJson(effectJson) {
    AppState.addedEffects = [];

    if (!effectJson) {
        renderCardEffects();
        return;
    }

    const storedEffects = Array.isArray(effectJson.effects)
        ? effectJson.effects
        : [effectJson];

    storedEffects.forEach((storedEffect) => {
        const config = resolveEffectConfig(storedEffect);
        if (!config) {
            console.warn('Effetto non riconosciuto e non importato:', storedEffect);
            return;
        }

        const params = getParamsForEditor(config, storedEffect);

        AppState.addedEffects.push({
            id: config.id,
            name: config.name,
            params,
            json: storedEffect,
            text: buildEffectText(config.id, params, storedEffect)
        });
    });

    renderCardEffects();
}

async function uploadImage(cardId, factionId) {
    if (!(AppState.currentImageFile instanceof Blob)) return null;

    const path = `${getFactionCode(factionId)}/${cardId}.webp`;

    const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, AppState.currentImageFile, {
            upsert: true,
            contentType: 'image/webp',
            cacheControl: '3600'
        });

    if (error) throw error;

    return supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(path)
        .data
        .publicUrl;
}

function buildEffectPayload() {
    if (!AppState.addedEffects.length) return null;

    const effects = AppState.addedEffects.map((effect) => {
        if (!effect.json || typeof effect.json !== 'object' || Array.isArray(effect.json)) {
            throw new Error(`L'effetto "${effect.name}" non ha dati JSON validi.`);
        }
        return effect.json;
    });

    return effects.length === 1 ? effects[0] : { effects };
}

function collectCardData() {
    const type = $('card-type').value;
    const factionId = Number($('faction').value);
    const rarity = factionId === 7 ? 'indrazzi' : $('rarity').value;
    const automaticText = AppState.addedEffects.map((effect) => effect.text).filter(Boolean).join('. ');

    return {
        name: $('card-name').value.trim(),
        faction_id: factionId,
        card_type: type,
        mana_cost: type === 'mostrissimo' ? 0 : Number($('mana-cost').value || 0),
        sacrifice_cost: type === 'mostrissimo' ? Number($('sacrifice-cost').value || 0) : 0,
        attack: isCreatureType(type) ? Number($('attack').value || 0) : null,
        hp: isCreatureType(type) ? Number($('hp').value || 0) : null,
        subtype: $('subtype').value.trim() || null,
        rarity,
        flavor_text: $('flavor-text').value.trim() || null,
        effect_text: $('effect-text').value.trim() || automaticText,
        effect_json: buildEffectPayload()
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

    let cardData;

    try {
        cardData = collectCardData();
    } catch (error) {
        console.error('Errore creazione payload effetti:', error);
        showMessage(`❌ Errore effetti: ${error.message}`, 'error');
        return;
    }

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

            const { error: deleteError } = await supabase
                .from('cards')
                .delete()
                .eq('id', duplicate.id);

            if (deleteError) throw deleteError;
        }

        let savedCard;

        if (AppState.isEditing) {
            showMessage('Aggiornamento carta ed effetti in corso...', 'success');

            const { data, error } = await supabase
                .from('cards')
                .update(cardData)
                .eq('id', AppState.editingCardId)
                .select()
                .single();

            if (error) throw error;
            savedCard = data;
        } else {
            showMessage('Creazione carta ed effetti in corso...', 'success');

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

        showMessage(
            `✅ Carta "${savedCard.name}" salvata correttamente.${cardData.effect_json ? ' Effetti strutturati salvati.' : ''}`,
            'success'
        );

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
        item.className = `card-item ${getFactionClass(card.faction_id)}`;

        const name = document.createElement('div');
        name.className = 'card-name';
        name.textContent = card.name;

        const meta = document.createElement('div');
        meta.className = 'card-meta';
        const cost = card.card_type === 'mostrissimo'
            ? `✦${card.sacrifice_cost || 0}`
            : `⚡${card.mana_cost}`;
        meta.textContent = `${card.factions?.name || '???'} • ${getCardTypeLabel(card.card_type)} • ${cost}`;

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

    $('editor-title').textContent = `Modifica: ${card.name}`;
    $('btn-save-card').textContent = '💾 Salva Modifiche';
    $('card-name').value = card.name || '';
    $('card-type').value = card.card_type || '';
    $('faction').value = card.faction_id || '';
    $('subtype').value = card.subtype || '';
    $('mana-cost').value = card.mana_cost ?? 0;
    $('sacrifice-cost').value = card.sacrifice_cost ?? 0;
    $('rarity').value = card.rarity || (Number(card.faction_id) === 7 ? 'indrazzi' : 'common');
    $('attack').value = card.attack ?? '';
    $('hp').value = card.hp ?? '';
    $('effect-text').value = card.effect_text || '';
    $('flavor-text').value = card.flavor_text || '';
    $('card-image').value = '';

    setStatsVisibility(card.card_type);
    setMostrissimoFields(card.card_type);
    synchronizeIndrazziRarity();
    setImageRequired(!AppState.originalImageUrl);

    $('image-preview').innerHTML = AppState.originalImageUrl
        ? `<img src="${AppState.originalImageUrl}" alt="${escapeHtml(card.name)}">`
        : '<p>Nessuna immagine salvata: seleziona un file.</p>';

    fillEffectsFromJson(card.effect_json);
    closeCardModal();
    updatePreview();

    document.querySelector('.form-section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });

    showMessage('📝 Modalità modifica attiva. Foto, statistiche, effetti e testi sono stati caricati.', 'success');
}

async function deleteSelectedCard() {
    const card = AppState.allCards.find((item) => item.id === AppState.selectedCardId);
    if (!card || !confirm(`Eliminare definitivamente "${card.name}"?`)) return;

    const { error } = await supabase
        .from('cards')
        .delete()
        .eq('id', card.id);

    if (error) {
        alert(`Errore: ${error.message}`);
        return;
    }

    closeCardModal();
    await loadAllCards();
}

function updatePreview() {
    const type = $('card-type').value;
    const factionId = Number($('faction').value);
    const isMostrissimo = type === 'mostrissimo';
    const creature = isCreatureType(type);
    const subtype = $('subtype').value.trim();
    const rarity = factionId === 7 ? 'indrazzi' : $('rarity').value;
    const rulesText = $('effect-text').value.trim() || AppState.addedEffects.map((effect) => effect.text).filter(Boolean).join('. ');
    const flavorText = $('flavor-text').value.trim();
    const costValue = isMostrissimo
        ? `✦${$('sacrifice-cost').value || 0}`
        : `⚡${$('mana-cost').value || 0}`;

    applyFactionClasses($('preview-card'), factionId);
    applyFactionClasses($('compact-preview-card'), factionId);

    $('preview-name').textContent = $('card-name').value || 'Nome Carta';
    $('preview-cost').textContent = costValue;
    $('preview-cost').title = isMostrissimo ? 'Sacrifici richiesti' : 'Costo mana';
    $('preview-type').textContent = getCardTypeLabel(type);
    $('preview-subtype').textContent = subtype ? `— ${subtype}` : '';
    $('preview-effect').innerHTML = formatRulesText(rulesText || 'Testo effetto...');
    $('preview-flavor').textContent = flavorText;
    $('preview-flavor').style.display = flavorText ? 'block' : 'none';
    $('preview-rarity').textContent = getRarityLabel(rarity);

    $('preview-atk').style.display = creature ? 'inline-flex' : 'none';
    $('preview-hp').style.display = creature ? 'inline-flex' : 'none';
    $('preview-atk').textContent = `⚔ ${$('attack').value || 0}`;
    $('preview-hp').textContent = `❤ ${$('hp').value || 0}`;
    $('preview-stats').style.display = creature ? 'flex' : 'none';

    const imageUrl = getPreviewImageUrl();
    $('preview-image').innerHTML = imageUrl
        ? `<img src="${imageUrl}" alt="Anteprima carta">`
        : '<span>Immagine</span>';

    $('compact-preview-name').textContent = $('card-name').value || 'Nome Carta';
    $('compact-preview-cost').textContent = costValue;
    $('compact-preview-type').textContent = getCardTypeLabel(type);
    $('compact-preview-atk').textContent = creature ? `⚔ ${$('attack').value || 0}` : '';
    $('compact-preview-hp').textContent = creature ? `❤ ${$('hp').value || 0}` : '';
    $('compact-preview-stats').style.display = creature ? 'flex' : 'none';
    $('compact-preview-image').innerHTML = imageUrl
        ? `<img src="${imageUrl}" alt="Miniatura carta">`
        : '🎴';
}

function filterCards() {
    const search = $('search-cards').value.toLowerCase();
    const factionId = $('filter-faction').value;

    const filtered = AppState.allCards.filter((card) => {
        const matchesSearch = !search ||
            card.name.toLowerCase().includes(search) ||
            (card.effect_text || '').toLowerCase().includes(search) ||
            (card.flavor_text || '').toLowerCase().includes(search) ||
            (card.subtype || '').toLowerCase().includes(search);

        const matchesFaction = !factionId || card.faction_id === Number(factionId);
        return matchesSearch && matchesFaction;
    });

    renderCardsGrid(filtered);
}

function bindEvents() {
    $('card-image')?.addEventListener('change', handleImageChange);

    $('card-type')?.addEventListener('change', (event) => {
        setStatsVisibility(event.target.value);
        setMostrissimoFields(event.target.value);
        updatePreview();
    });

    $('faction')?.addEventListener('change', () => {
        synchronizeIndrazziRarity();
        updatePreview();
    });

    $('rarity')?.addEventListener('change', updatePreview);

    [
        'card-name',
        'subtype',
        'mana-cost',
        'sacrifice-cost',
        'attack',
        'hp',
        'effect-text',
        'flavor-text'
    ].forEach((id) => {
        $(id)?.addEventListener('input', updatePreview);
    });

    $('card-form')?.addEventListener('submit', saveCard);

    $('btn-preview')?.addEventListener('click', (event) => {
        event.preventDefault();
        updatePreview();
        document.querySelector('.preview-section')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
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
    buildEffectPayload,
    buildStoredEffect,
    resetEffects: () => {
        localStorage.removeItem('bellum_effects');
        location.reload();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initializeEffects();
    bindEvents();
    setStatsVisibility();
    setMostrissimoFields();
    synchronizeIndrazziRarity();
    setImageRequired(true);
    renderCardEffects();
    updatePreview();
    loadAllCards();
});