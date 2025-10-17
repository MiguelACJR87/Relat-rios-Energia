// =================================================================
// CONFIGURAÇÃO GLOBAL
// =================================================================
const APPS_SCRIPT_API_URL = "https://script.google.com/macros/s/AKfycbxKRogXSYUx7Fmay-OO98v1sc1Z8cqf_nuwPy9fKN1aZJGWHkjZ6BCpcxLYqutnK9Qweg/exec";

let AppState = {
    selectedSpreadsheetId: null,
    selectedCondoName: null,
    logoData: null,
    medicoes: [],
    previewData: {} // Cache para os HTMLs da pré-visualização
};

// =================================================================
// CLASSES DE UTILIDADE
// =================================================================
class NotificationManager {
    static show(message, type = 'info', duration = 5000) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${message}</span><button onclick="this.parentElement.remove()" class="ml-4 text-white">&times;</button>`;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    static success(message) { this.show(message, 'success'); }
    static error(message) { this.show(message, 'error', 8000); }
    static warning(message) { this.show(message, 'warning'); }
}

class ProgressManager {
    static show() { document.getElementById('progress-container')?.classList.remove('hidden'); }
    static hide() { document.getElementById('progress-container')?.classList.add('hidden'); }
    static update(percent, text = '') {
        const fill = document.getElementById('progress-fill');
        const textEl = document.getElementById('progress-text');
        const labelEl = document.getElementById('progress-label');
        if (fill) fill.style.width = `${percent}%`;
        if (textEl) textEl.textContent = `${Math.round(percent)}%`;
        if (labelEl) labelEl.textContent = text;
    }
}

// =================================================================
// CLASSE PRINCIPAL DA APLICAÇÃO
// =================================================================
class DashboardApp {
    constructor() {
        this.initializeElements();
        this.attachEventListeners();
        this.loadCondominios();
    }

    initializeElements() {
        this.elements = {
            condoSelectorScreen: document.getElementById('condo-selector-screen'),
            mainDashboardScreen: document.getElementById('main-dashboard-screen'),
            condoList: document.getElementById('condo-list'),
            dashboardTitle: document.getElementById('dashboard-title'),
            backToSelectorBtn: document.getElementById('back-to-selector'),
            fileInput: document.getElementById('fileInput'),
            fileFeedback: document.getElementById('file-feedback'),
            logoInput: document.getElementById('logoInput'),
            logoFeedback: document.getElementById('logo-feedback'),
            periodoDe: document.getElementById('periodo-de'),
            periodoAte: document.getElementById('periodo-ate'),
            proximaLeitura: document.getElementById('proxima-leitura'),
            tarifaEnergia: document.getElementById('tarifa-energia'),
            taxaGestao: document.getElementById('taxa-gestao'),
            rateioAreaComum: document.getElementById('rateio-area-comum'),
            processButton: document.getElementById('process-button'),
            previewButton: document.getElementById('preview-button'),
            downloadLinksSection: document.getElementById('download-links-section'),
            downloadLinksContainer: document.getElementById('download-links-container'),
            reportContainer: document.getElementById('reportContainer'),
            previewContainer: document.getElementById('previewContainer'),
            closePreviewButton: document.getElementById('closePreviewButton'),
            previewTabs: document.getElementById('preview-tabs'),
            previewTabContent: document.getElementById('preview-tab-content')
        };
    }

    attachEventListeners() {
        this.elements.backToSelectorBtn.addEventListener('click', () => this.showSelectorScreen());
        this.elements.processButton.addEventListener('click', () => this.handleProcessRequest());
        this.elements.previewButton.addEventListener('click', () => this.showPreview());
        this.elements.closePreviewButton.addEventListener('click', () => this.elements.previewContainer.classList.add('hidden'));
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.elements.logoInput.addEventListener('change', (e) => this.handleLogoSelect(e));
        this.elements.reportContainer.addEventListener('input', (e) => this.handleCellEdit(e));
        this.elements.reportContainer.addEventListener('change', (e) => this.handleCheckboxChange(e));

        const formInputs = [this.elements.periodoDe, this.elements.periodoAte, this.elements.tarifaEnergia];
        formInputs.forEach(input => input.addEventListener('input', () => this.validateForm()));
    }

    async loadCondominios() {
        if (!APPS_SCRIPT_API_URL || APPS_SCRIPT_API_URL.includes("COLE_AQUI")) {
            this.elements.condoList.innerHTML = `<div class="col-span-full text-center p-10 bg-white rounded-lg shadow"><i class="fas fa-exclamation-triangle text-red-500 text-4xl mb-4"></i><h3 class="text-xl font-bold text-red-700">API não configurada</h3><p class="text-gray-600 mt-2">A URL da API do Google Apps Script não foi definida no arquivo <strong>script.js</strong>.</p></div>`;
            return;
        }
        try {
            const request = new Request(APPS_SCRIPT_API_URL, { method: 'GET', mode: 'cors', redirect: 'follow' });
            const response = await fetch(request);
            if (!response.ok) throw new Error(`Erro de rede: ${response.status} ${response.statusText}`);
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            this.displayCondoCards(result.data);
        } catch (error) {
            this.elements.condoList.innerHTML = `<div class="col-span-full text-center p-10 bg-white rounded-lg shadow"><i class="fas fa-exclamation-triangle text-red-500 text-4xl mb-4"></i><h3 class="text-xl font-bold text-red-700">Falha na Conexão com a API</h3><p class="text-gray-600 mt-2">Não foi possível buscar os condomínios. Verifique as permissões da API e sua conexão.</p><p class="text-xs text-gray-500 mt-4">Detalhes: ${error.message}</p></div>`;
        }
    }

    displayCondoCards(condominios) {
        this.elements.condoList.innerHTML = '';
        if (!condominios || condominios.length === 0) {
            this.elements.condoList.innerHTML = `<div class="col-span-full text-center p-10 bg-white rounded-lg shadow"><i class="fas fa-folder-open text-yellow-500 text-4xl mb-4"></i><h3 class="text-xl font-bold">Nenhum condomínio encontrado</h3><p class="text-gray-600 mt-2">Nenhum arquivo Google Sheets foi encontrado na pasta configurada no Google Drive.</p></div>`;
            return;
        }
        condominios.forEach(condo => {
            const card = document.createElement('div');
            card.className = 'bg-white rounded-lg shadow-md p-6 text-center cursor-pointer hover:shadow-xl hover:transform hover:-translate-y-1 transition-all duration-300';
            card.innerHTML = `<i class="fas fa-building text-4xl text-blue-500 mb-4"></i><h3 class="text-lg font-bold text-gray-800">${condo.name}</h3>`;
            card.addEventListener('click', () => this.selectCondo(condo.id, condo.name));
            this.elements.condoList.appendChild(card);
        });
    }

    selectCondo(spreadsheetId, condoName) {
        AppState.selectedSpreadsheetId = spreadsheetId;
        AppState.selectedCondoName = condoName;
        this.elements.dashboardTitle.innerHTML = `<i class="fas fa-chart-line text-blue-600 mr-3"></i> ${condoName}`;
        this.showDashboardScreen();
    }

    showDashboardScreen() {
        this.elements.condoSelectorScreen.classList.add('hidden');
        this.elements.mainDashboardScreen.classList.remove('hidden');
        this.resetDashboard();
    }

    showSelectorScreen() {
        this.elements.mainDashboardScreen.classList.add('hidden');
        this.elements.condoSelectorScreen.classList.remove('hidden');
        AppState.selectedSpreadsheetId = null;
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) { this.elements.fileFeedback.innerHTML = ''; return; }
        if (!file.name.toLowerCase().endsWith('.xlsx')) {
            NotificationManager.error("Formato de arquivo inválido. Use .xlsx");
            this.elements.fileFeedback.innerHTML = `<div class="text-red-600">Arquivo inválido.</div>`;
            this.elements.fileInput.value = '';
            return;
        }
        this.elements.fileFeedback.innerHTML = `<div class="text-green-600 flex items-center"><i class="fas fa-check-circle mr-2"></i>Arquivo "${file.name}" carregado.</div>`;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                this.processAndDisplayTable(jsonData);
            } catch (error) {
                NotificationManager.error("Erro ao ler o arquivo .xlsx.");
                console.error(error);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    processAndDisplayTable(jsonData) {
        if (jsonData.length === 0) {
            NotificationManager.warning("A planilha está vazia.");
            AppState.medicoes = [];
            this.renderTable();
            return;
        }
        const normalizeHeader = (h) => String(h).trim().toLowerCase().replace(/\s+/g, '_');
        const normalizedData = jsonData.map(row => {
            const newRow = {};
            for (const key in row) {
                newRow[normalizeHeader(key)] = row[key];
            }
            return newRow;
        });
        AppState.medicoes = normalizedData.map(row => ({
            unidade: row.unidade || 'N/A',
            leitura_anterior: parseFloat(row.leitura_anterior) || 0,
            leitura_atual: parseFloat(row.leitura_atual) || 0,
            isCommonArea: ['true', 'sim', '1', 's', 'verdadeiro'].includes(String(row.area_comum).trim().toLowerCase())
        }));
        this.renderTable();
    }

    renderTable() {
        if (AppState.medicoes.length === 0) {
            this.elements.reportContainer.innerHTML = `<div class="flex flex-col items-center justify-center py-16 text-gray-500"><i class="fas fa-cloud-upload-alt text-5xl mb-4 text-gray-300"></i><p>Aguardando importação do arquivo de medições...</p></div>`;
            this.validateForm();
            return;
        }
        let tableHTML = `<div class="overflow-x-auto"><table class="min-w-full divide-y divide-gray-200"><thead class="bg-gray-50"><tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unidade</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Leitura Anterior</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Leitura Atual</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Consumo (m³)</th>
            <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Área Comum</th>
            </tr></thead><tbody class="bg-white divide-y divide-gray-200">`;
        AppState.medicoes.forEach((row, index) => {
            const consumo = (row.leitura_atual - row.leitura_anterior).toFixed(3);
            const isNegative = consumo < 0;
            tableHTML += `<tr data-index="${index}" class="${isNegative ? 'negative-consumption' : ''}">
                <td class="px-6 py-4 whitespace-nowrap">${row.unidade}</td>
                <td class="px-6 py-4 whitespace-nowrap editable-cell" contenteditable="true" data-field="leitura_anterior">${row.leitura_anterior}</td>
                <td class="px-6 py-4 whitespace-nowrap editable-cell" contenteditable="true" data-field="leitura_atual">${row.leitura_atual}</td>
                <td class="px-6 py-4 whitespace-nowrap font-medium consumo-cell ${isNegative ? 'text-red-600' : ''}">${consumo}</td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    <input type="checkbox" class="common-area-checkbox h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" ${row.isCommonArea ? 'checked' : ''}>
                </td>
            </tr>`;
        });
        tableHTML += `</tbody></table></div>`;
        this.elements.reportContainer.innerHTML = tableHTML;
        this.validateForm();
    }

    handleCellEdit(event) {
        const cell = event.target;
        if (!cell.classList.contains('editable-cell')) return;
        const rowEl = cell.closest('tr');
        const index = parseInt(rowEl.dataset.index);
        const field = cell.dataset.field;
        const newValue = parseFloat(cell.textContent) || 0;
        AppState.medicoes[index][field] = newValue;
        const updatedRow = AppState.medicoes[index];
        const consumo = updatedRow.leitura_atual - updatedRow.leitura_anterior;
        const consumoCell = rowEl.querySelector('.consumo-cell');
        consumoCell.textContent = consumo.toFixed(3);
        rowEl.classList.toggle('negative-consumption', consumo < 0);
        consumoCell.classList.toggle('text-red-600', consumo < 0);
    }

    handleCheckboxChange(event) {
        const checkbox = event.target;
        if (checkbox.type !== 'checkbox' || !checkbox.classList.contains('common-area-checkbox')) return;
        const rowEl = checkbox.closest('tr');
        if (!rowEl) return;
        const index = parseInt(rowEl.dataset.index);
        if (isNaN(index)) return;
        AppState.medicoes[index].isCommonArea = checkbox.checked;
    }

    async handleLogoSelect(event) {
        const file = event.target.files[0];
        if (!file) { this.elements.logoFeedback.innerHTML = ''; AppState.logoData = null; return; }
        try {
            AppState.logoData = await this.readFileAsBase64(file);
            this.elements.logoFeedback.innerHTML = `<div class="text-green-600 flex items-center"><i class="fas fa-check-circle mr-2"></i>Logo carregado.</div>`;
        } catch (error) { NotificationManager.error("Não foi possível carregar o logo."); }
    }

    readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    }

    validateForm() {
        const fileOk = AppState.medicoes.length > 0;
        const datesOk = this.elements.periodoDe.value && this.elements.periodoAte.value;
        const tarifaOk = this.elements.tarifaEnergia.value;
        const isValid = fileOk && datesOk && tarifaOk;
        this.elements.processButton.disabled = !isValid;
        this.elements.previewButton.disabled = !isValid;
        return isValid;
    }

    resetDashboard() {
        AppState.medicoes = [];
        AppState.previewData = {};
        this.elements.fileInput.value = '';
        this.elements.logoInput.value = '';
        this.elements.fileFeedback.innerHTML = '';
        this.elements.logoFeedback.innerHTML = '';
        this.elements.downloadLinksSection.classList.add('hidden');
        this.elements.downloadLinksContainer.innerHTML = '';
        this.elements.previewContainer.classList.add('hidden');
        this.elements.reportContainer.innerHTML = `<div class="flex flex-col items-center justify-center py-16 text-gray-500"><i class="fas fa-cloud-upload-alt text-5xl mb-4 text-gray-300"></i><p>Aguardando importação do arquivo de medições...</p></div>`;
        this.elements.processButton.disabled = true;
        this.elements.previewButton.disabled = true;
        ProgressManager.hide();
        const today = new Date();
        this.elements.periodoDe.value = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        this.elements.periodoAte.value = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
    }

    async showPreview() {
        if (!this.validateForm()) {
            NotificationManager.warning("Preencha todos os campos e carregue um arquivo para visualizar.");
            return;
        }
        ProgressManager.show();
        ProgressManager.update(20, 'Gerando simulação...');
        try {
            const payload = {
                action: 'getPreviewHtml',
                spreadsheetId: AppState.selectedSpreadsheetId,
                medicoes: AppState.medicoes,
                logoContent: AppState.logoData,
                periodoDe: this.elements.periodoDe.value,
                periodoAte: this.elements.periodoAte.value,
                proximaLeitura: this.elements.proximaLeitura.value,
                tarifaEnergia: this.elements.tarifaEnergia.value.replace(',', '.'),
                taxaGestao: this.elements.taxaGestao.value.replace(',', '.'),
                rateioAreaComum: this.elements.rateioAreaComum.checked
            };
            const response = await fetch(APPS_SCRIPT_API_URL, {
                method: 'POST',
                body: JSON.stringify(payload),
                redirect: 'follow'
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            AppState.previewData = result.previews;
            this.buildPreviewTabs();
            this.elements.previewContainer.classList.remove('hidden');
            this.elements.previewContainer.scrollIntoView({ behavior: 'smooth' });
        } catch (error) {
            NotificationManager.error(`Erro ao gerar simulação: ${error.message}`);
        } finally {
            ProgressManager.hide();
        }
    }

    buildPreviewTabs() {
        const tabsContainer = this.elements.previewTabs;
        if (!tabsContainer) return;
        tabsContainer.innerHTML = '';
        
        const globalTab = document.createElement('button');
        globalTab.className = 'preview-tab active';
        globalTab.textContent = 'Relatório Global';
        globalTab.dataset.target = 'global';
        tabsContainer.appendChild(globalTab);

        AppState.previewData.individuals.forEach((individual, index) => {
            const individualTab = document.createElement('button');
            individualTab.className = 'preview-tab';
            individualTab.textContent = `Unid. ${individual.unidade}`;
            individualTab.dataset.target = `individual-${index}`;
            tabsContainer.appendChild(individualTab);
        });
        
        // Remove old event listener before adding a new one to prevent duplicates
        const newTabsContainer = tabsContainer.cloneNode(true);
        tabsContainer.parentNode.replaceChild(newTabsContainer, tabsContainer);
        this.elements.previewTabs = newTabsContainer;

        newTabsContainer.addEventListener('click', (e) => {
            const targetButton = e.target.closest('.preview-tab');
            if (targetButton) {
                newTabsContainer.querySelectorAll('.preview-tab').forEach(tab => tab.classList.remove('active'));
                targetButton.classList.add('active');
                this.showPreviewTabContent(targetButton.dataset.target);
            }
        });

        this.showPreviewTabContent('global');
    }

    showPreviewTabContent(target) {
        const contentContainer = this.elements.previewTabContent;
        if (!contentContainer) return;

        let htmlContent = '';
        if (target === 'global') {
            htmlContent = AppState.previewData.global;
        } else if (target.startsWith('individual-')) {
            const index = parseInt(target.split('-')[1], 10);
            htmlContent = AppState.previewData.individuals[index].html;
        }

        if (!htmlContent) {
            contentContainer.innerHTML = '<p class="p-6 text-gray-500">Não foi possível carregar a pré-visualização.</p>';
            return;
        }

        contentContainer.innerHTML = '';
        const iframe = document.createElement('iframe');
        iframe.className = 'w-full border-0';
        iframe.style.height = '80vh';
        iframe.title = `Pré-visualização do Relatório: ${target}`;
        
        contentContainer.appendChild(iframe);
        
        const iframeDoc = iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(htmlContent);
        iframeDoc.close();
    }


    async handleProcessRequest() {
        if (!this.validateForm()) {
            NotificationManager.warning("Preencha todos os campos e carregue um arquivo para gerar os relatórios.");
            return;
        }
        ProgressManager.show();
        ProgressManager.update(10, 'Preparando dados...');
        try {
            const payload = {
                action: 'processReport',
                spreadsheetId: AppState.selectedSpreadsheetId,
                medicoes: AppState.medicoes,
                logoContent: AppState.logoData,
                periodoDe: this.elements.periodoDe.value,
                periodoAte: this.elements.periodoAte.value,
                proximaLeitura: this.elements.proximaLeitura.value,
                tarifaEnergia: this.elements.tarifaEnergia.value.replace(',', '.'),
                taxaGestao: this.elements.taxaGestao.value.replace(',', '.'),
                rateioAreaComum: this.elements.rateioAreaComum.checked
            };
            ProgressManager.update(30, 'Enviando para o servidor...');
            const response = await fetch(APPS_SCRIPT_API_URL, {
                method: 'POST',
                body: JSON.stringify(payload),
                redirect: 'follow'
            });
            ProgressManager.update(70, 'Aguardando processamento...');
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            ProgressManager.update(100, 'Relatórios Prontos!');
            NotificationManager.success(result.message);
            this.displayDownloadLinks(result.downloadLinks);
        } catch (error) {
            ProgressManager.hide();
            NotificationManager.error(`Erro: ${error.message}`);
        }
    }

    displayDownloadLinks(links) {
        this.elements.downloadLinksContainer.innerHTML = `
            <a href="${links.globalPdfUrl}" target="_blank" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium flex items-center"><i class="fas fa-file-pdf mr-2"></i>Baixar Relatório Global</a>
            <a href="${links.individualZipUrl}" target="_blank" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium flex items-center"><i class="fas fa-file-archive mr-2"></i>Baixar Relatórios Individuais</a>
        `;
        this.elements.downloadLinksSection.classList.remove('hidden');
        ProgressManager.hide();
    }
}

document.addEventListener('DOMContentLoaded', () => new DashboardApp());

