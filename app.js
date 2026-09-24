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
    ultra_rare: 'Ultra rara',
    legendary: 'Leggendaria'
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
    allSubtypes: [],
    selectedSubtypeIds: new Set(),
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

function showSubtypeMessage(message, type = 'success') {
    const element = $('subtype-message');
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

function plainText(value) {
    return String(value || '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function compactEffectText(value) {
    const text = plainText(value);
    if (!text) return 'Nessun effetto.';
    return text.length > 92 ? `${text.slice(0, 89).trimEnd()}…` : text;
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

function getSelectedSubtypeIds() {
    const selector = $('card-subtypes');
    if (!selector) return [];
    return Array.from(selector.selectedOptions).map((option) => option.value);
}

function getSelectedSubtypeNames() {
    const selectedIds = new Set(getSelectedSubtypeIds());
    return AppState.allSubtypes
        .filter((subtype) => selectedIds.has(subtype.id))
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'it'))
        .map((subtype) => subtype.name);
}

function renderSubtypeSelector(selectedIds = AppState.selectedSubtypeIds) {
    const selector = $('card-subtypes');
    if (!selector) return;

    const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
    selector.innerHTML = '';

    const activeSubtypes = AppState.allSubtypes
        .filter((subtype) => subtype.is_active)
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'it'));

    activeSubtypes.forEach((subtype) => {
        const option = document.createElement('option');
        option.value = subtype.id;
        option.textContent = subtype.name;
        option.title = subtype.description || subtype.name;
        option.selected = selected.has(subtype.id);
        selector.appendChild(option);
    });

    AppState.selectedSubtypeIds = new Set(getSelectedSubtypeIds());
    renderSelectedSubtypeBadges();
}

function renderSelectedSubtypeBadges() {
    const container = $('selected-subtypes');
    if (!container) return;

    const names = getSelectedSubtypeNames();
    container.innerHTML = '';

    if (!names.length) {
        container.innerHTML = '<span class="no-subtypes">Nessun sottotipo selezionato</span>';
        return;
    }

    names.forEach((name) => {
        const badge = document.createElement('span');
        badge.className = 'subtype-badge';
        badge.textContent = name;
        container.appendChild(badge);
    });
}

function renderSubtypesManagementList() {
    const container = $('subtypes-list-container');
    if (!container) return;

    container.innerHTML = '';

    if (!AppState.allSubtypes.length) {
        container.innerHTML = '<p class="no-effects">Nessun sottotipo presente.</p>';
        return;
    }

    AppState.allSubtypes
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'it'))
        .forEach((subtype) => {
            const item = document.createElement('div');
            item.className = `subtype-card ${subtype.is_active ? '' : 'subtype-inactive'}`;

            const info = document.createElement('div');
            info.className = 'subtype-card-info';

            const name = document.createElement('div');
            name.className = 'subtype-card-name';
            name.textContent = subtype.name;

            const description = document.createElement('div');
            description.className = 'subtype-card-description';
            description.textContent = subtype.description || 'Nessuna descrizione.';

            const status = document.createElement('div');
            status.className = 'subtype-card-status';
            status.textContent = subtype.is_active ? 'Attivo' : 'Disattivato';

            const toggleButton = document.createElement('button');
            toggleButton.type = 'button';
            toggleButton.className = subtype.is_active ? 'btn-secondary' : 'btn-view';
            toggleButton.textContent = subtype.is_active ? 'Disattiva' : 'Riattiva';
            toggleButton.addEventListener('click', () => toggleSubtypeStatus(subtype));

            info.append(name, description, status);
            item.append(info, toggleButton);
            container.appendChild(item);
        });
}

async function loadSubtypes() {
    const { data, error } = await supabase
        .from('card_subtypes')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

    if (error) {
        console.error('Errore caricamento sottotipi:', error);
        showSubtypeMessage(`❌ Errore caricamento sottotipi: ${error.message}`, 'error');
        return false;
    }

    AppState.allSubtypes = data || [];
    renderSubtypeSelector(AppState.selectedSubtypeIds);
    renderSubtypesManagementList();
    return true;
}

async function createSubtype(event) {
    event.preventDefault();

    const name = $('subtype-name').value.trim();
    const description = $('subtype-description').value.trim() || null;

    if (name.length < 2) {
        showSubtypeMessage('Inserisci un nome di almeno 2 caratteri.', 'error');
        return;
    }

    const normalizedName = name.toLowerCase();
    const maxSortOrder = AppState.allSubtypes.reduce(
        (maximum, subtype) => Math.max(maximum, Number(subtype.sort_order) || 0),
        0
    );

    const { error } = await supabase
        .from('card_subtypes')
        .insert({
            name,
            normalized_name: normalizedName,
            description,
            sort_order: maxSortOrder + 10,
            is_active: true
        });

    if (error) {
        const message = error.code === '23505'
            ? 'Esiste già un sottotipo con questo nome.'
            : error.message;
        showSubtypeMessage(`❌ Errore: ${message}`, 'error');
        return;
    }

    $('subtype-form').reset();
    showSubtypeMessage(`✅ Sottotipo "${name}" creato.`, 'success');
    await loadSubtypes();
}

async function toggleSubtypeStatus(subtype) {
    const nextStatus = !subtype.is_active;
    const action = nextStatus ? 'riattivare' : 'disattivare';

    if (!confirm(`Vuoi ${action} il sottotipo "${subtype.name}"?`)) return;

    const { error } = await supabase
        .from('card_subtypes')
        .update({ is_active: nextStatus })
        .eq('id', subtype.id);

    if (error) {
        showSubtypeMessage(`❌ Errore: ${error.message}`, 'error');
        return;
    }

    if (!nextStatus) {
        AppState.selectedSubtypeIds.delete(subtype.id);
    }

    showSubtypeMessage(`✅ Sottotipo "${subtype.name}" ${nextStatus ? 'riattivato' : 'disattivato'}.`, 'success');
    await loadSubtypes();
    updatePreview();
}

function initializeSubtypes() {
    $('card-subtypes')?.addEventListener('change', () => {
        AppState.selectedSubtypeIds = new Set(getSelectedSubtypeIds());
        renderSelectedSubtypeBadges();
        updatePreview();
    });

    $('subtype-form')?.addEventListener('submit', createSubtype);
    $('btn-refresh-subtypes')?.addEventListener('click', loadSubtypes);
}

async function saveCardSubtypeLinks(cardId, subtypeIds) {
    const { error: deleteError } = await supabase
        .from('card_subtype_links')
        .delete()
        .eq('card_id', cardId);

    if (deleteError) throw deleteError;

    if (!subtypeIds.length) return;

    const rows = subtypeIds.map((subtypeId) => ({
        card_id: cardId,
        subtype_id: subtypeId
    }));

    const { error: insertError } = await supabase
        .from('card_subtype_links')
        .insert(rows);

    if (insertError) throw insertError;
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
    AppState.selectedSubtypeIds = new Set();
    AppState.isEditing = false;
    AppState.editingCardId = null;

    $('editor-title').textContent = 'Nuova Carta';
    $('btn-save-card').textContent = '💾 Salva Carta';
    $('card-image').value = '';
    $('image-preview').innerHTML = '<p>Anteprima immagine</p>';
    setImageRequired(true);
    setStatsVisibility();
    setMostrissimoFields();
    renderSubtypeSelector(AppState.selectedSubtypeIds);
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
    const automaticText = AppState.addedEffects.map((effect) => effect.text).filter(Boolean).join('. ');

    return {
        name: $('card-name').value.trim(),
        faction_id: Number($('faction').value),
        card_type: type,
        mana_cost: type === 'mostrissimo' ? 0 : Number($('mana-cost').value || 0),
        sacrifice_cost: type === 'mostrissimo' ? Number($('sacrifice-cost').value || 0) : 0,
        attack: isCreatureType(type) ? Number($('attack').value || 0) : null,
        hp: isCreatureType(type) ? Number($('hp').value || 0) : null,
        subtype: getSelectedSubtypeNames().join(' ') || null,
        rarity: $('rarity').value,
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

    const subtypeIds = getSelectedSubtypeIds();
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
            showMessage('Aggiornamento carta, effetti e sottotipi in corso...', 'success');

            const { data, error } = await supabase
                .from('cards')
                .update(cardData)
                .eq('id', AppState.editingCardId)
                .select()
                .single();

            if (error) throw error;
            savedCard = data;
        } else {
            showMessage('Creazione carta, effetti e sottotipi in corso...', 'success');

            const { data, error } = await supabase
                .from('cards')
                .insert(cardData)
                .select()
                .single();

            if (error) throw error;
            savedCard = data;
        }

        await saveCardSubtypeLinks(savedCard.id, subtypeIds);

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
        .select(`
            *,
            factions(name, code, color_hex),
            card_subtype_links(
                subtype_id,
                card_subtypes(id, name, sort_order, is_active)
            )
        `)
        .order('created_at', { ascending: false });

    if (error) {
        if (grid) grid.innerHTML = `<p>Errore database: ${error.message}</p>`;
        return;
    }

    AppState.allCards = (data || []).map((card) => ({
        ...card,
        structuredSubtypes: (card.card_subtype_links || [])
            .map((link) => link.card_subtypes)
            .filter(Boolean)
            .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'it'))
    }));

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
        const subtypeText = card.structuredSubtypes?.map((subtype) => subtype.name).join(' ') || card.subtype || '';
        meta.textContent = `${card.factions?.name || '???'} • ${getCardTypeLabel(card.card_type)}${subtypeText ? ` — ${subtypeText}` : ''} • ${cost}`;

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
    AppState.selectedSubtypeIds = new Set((card.structuredSubtypes || []).map((subtype) => subtype.id));

    $('editor-title').textContent = `Modifica: ${card.name}`;
    $('btn-save-card').textContent = '💾 Salva Modifiche';
    $('card-name').value = card.name || '';
    $('card-type').value = card.card_type || '';
    $('faction').value = card.faction_id || '';
    $('mana-cost').value = card.mana_cost ?? 0;
    $('sacrifice-cost').value = card.sacrifice_cost ?? 0;
    $('rarity').value = card.rarity || 'common';
    $('attack').value = card.attack ?? '';
    $('hp').value = card.hp ?? '';
    $('effect-text').value = card.effect_text || '';
    $('flavor-text').value = card.flavor_text || '';
    $('card-image').value = '';

    setStatsVisibility(card.card_type);
    setMostrissimoFields(card.card_type);
    renderSubtypeSelector(AppState.selectedSubtypeIds);
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

    showMessage('📝 Modalità modifica attiva. Foto, effetti e sottotipi sono stati caricati.', 'success');
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
    const subtypeNames = getSelectedSubtypeNames();
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
    $('preview-subtype').textContent = subtypeNames.length ? `— ${subtypeNames.join(' ')}` : '';
    $('preview-effect').innerHTML = formatRulesText(rulesText || 'Testo effetto...');
    $('preview-flavor').textContent = flavorText;
    $('preview-flavor').style.display = flavorText ? 'block' : 'none';
    $('preview-rarity').textContent = getRarityLabel($('rarity').value);

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
    $('compact-preview-effect').textContent = compactEffectText(rulesText);
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
        const subtypeText = card.structuredSubtypes?.map((subtype) => subtype.name).join(' ') || card.subtype || '';
        const matchesSearch = !search ||
            card.name.toLowerCase().includes(search) ||
            (card.effect_text || '').toLowerCase().includes(search) ||
            (card.flavor_text || '').toLowerCase().includes(search) ||
            subtypeText.toLowerCase().includes(search);

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

    ['card-name', 'faction', 'rarity', 'mana-cost', 'sacrifice-cost', 'attack', 'hp', 'effect-text', 'flavor-text'].forEach((id) => {
        $(id)?.addEventListener('input', updatePreview);
        $(id)?.addEventListener('change', updatePreview);
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
    loadSubtypes,
    updatePreview,
    buildEffectPayload,
    buildStoredEffect,
    resetEffects: () => {
        localStorage.removeItem('bellum_effects');
        location.reload();
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    initializeEffects();
    initializeSubtypes();
    bindEvents();
    setStatsVisibility();
    setMostrissimoFields();
    setImageRequired(true);
    renderCardEffects();
    updatePreview();
    await loadSubtypes();
    await loadAllCards();
});