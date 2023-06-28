'use strict'
process.on('message', (requestData) => {
  exportarVotacionesDW(requestData)
})

require('../error')
const { workbook, worksheet, createHeaders, createAt } = require('../exceljs')
const { con } = require('../db')
const { response } = require('../response')

const {
  //constants
  MODALITIES_GROUPS,
  CHECK_MODALITIES,
  
  // functions
  getCampaigns,
  getCampaignRequirements,
  getCampaignUsersRequirement
} = require('../helper/Votaciones');

const {
  pluck, logtime
} = require('../helper/Helper');

const {
  getUserCriterionValues2,
} = require('../helper/Usuarios');

const {
  getGenericHeadersByCriterioCodes,
  getWorkspaceCriteriaByCodes,
  getWorkspaceCriteria
} = require('../helper/Criterios');

const { getCriterioFechaReconocimiento } = require('../helper/Workspace');

const moment = require('moment')

const Headers = [
  // campaña
  'FECHA DE INGRESO',

  'NOMBRE DE LA CAMPAÑA',
  'CRITERIO',
  'VALOR DE ASOCIACION',
  'ETAPA CONTENIDO',
  'ETAPA RECONOCIMIENTO',
  'ETAPA DE VOTACIONES',
  '% DE AVANCE POR ETAPAS'
];

async function exportarVotacionesDW({ workspaceId, campaigns, CampaignsActivos, CampaignsInactivos }) {

  const campaigns_estados = ((CampaignsActivos && CampaignsInactivos) || 
                             (!CampaignsActivos && !CampaignsInactivos)) ? [1, 0] :
                                 (CampaignsActivos) ? [1] : [0];

  // createHeaders(Headers);
  const campaigns_data = await getCampaigns(campaigns, campaigns_estados);
  const { criterio_id_fecha_inicio_reconocimiento } = await getCriterioFechaReconocimiento(workspaceId);
  const { etapas: campaign_all_etapas } = MODALITIES_GROUPS[0];

  // === headers ===
  let [ headerIdCriterioFecha ] = await getWorkspaceCriteria(workspaceId, [ criterio_id_fecha_inicio_reconocimiento ]);
  let headersEstaticos = await getGenericHeadersByCriterioCodes(workspaceId," 'module', 'gender', 'position_name', 'date_start', 'seniority_date', 'birthday_date' ");
      headersEstaticos.push(headerIdCriterioFecha.name);

  await createHeaders(headersEstaticos.concat(Headers));
  // === headers ===

  // === criterios by workspaceid ===
  const workspaceCriteriaCodes = await getWorkspaceCriteriaByCodes(workspaceId, ` 'module', 'gender', 'position_name', 'date_start', 'seniority_date', 'birthday_date', '${headerIdCriterioFecha.code}' `);
  const workspaceCriteriaNames = pluck(workspaceCriteriaCodes, 'name');
  // === criterios by workspaceid ===

  let StackUserCriterios = {};
  logtime('Start-reportes');

  for(const campaign of campaigns_data) { 

     const { 
            title, 
            stage_id, 
            CampaignRequirements: requirements,
            CampaignModules: modules,
            id: campaign_id 
          } = campaign; // datos de campaña

    const { etapas: modalities } = MODALITIES_GROUPS[stage_id];
    const subworkspaces_ids = pluck(modules, 'module_id');

    const campaign_requirements = await getCampaignRequirements(requirements); // requisitos de campaña
    const campaign_users = await getCampaignUsersRequirement(campaign_requirements, { subworkspaces_ids, 
                                                                                      criterio_id_fecha_inicio_reconocimiento,
                                                                                      workspaceId }); // usuarios de campaña

    // === criterio - campaña ===
    const { VOTERS } = campaign_requirements; 
    let campaign_criterio = '-';
    if (VOTERS) {
      if(VOTERS.req_data) {
        const [ response_criterio ] = await getWorkspaceCriteria(workspaceId, [ VOTERS.req_data.criterio_id ]); 
        campaign_criterio = response_criterio.name;
      }
    } 
    // === criterio - campaña ===

    // === etapas - campaña ===
    // logtime('user-stages', campaign_id);
    let ARRAY_USERS_STAGES = {};
    for(const section of campaign_all_etapas) {
        const exist_etapa = modalities.some((ele) => (ele.key === section.key)); 
        ARRAY_USERS_STAGES[section.key] = (exist_etapa) ? await CHECK_MODALITIES[section.key](campaign_id) 
                        : '-';
    }
    // logtime('user-stages', campaign_id);
    // === etapas - campaña ===

    // === MATCH_USUARIOS - CAMPAÑA ===
    let campaign_criterio_value = '-';
    for(const user of campaign_users) {

      const { id } = user;
      const cellRow = [];


      // === usuario ====
      cellRow.push(user.name);
      cellRow.push(user.lastname);
      cellRow.push(user.surname);
      cellRow.push(user.document);
      cellRow.push(user.active ? 'Activo' : 'Inactivo');
      // === usuario ====


      // === criterios de usuario ===
      // logtime('start: user-criterio', user.id);
      if(StackUserCriterios[id]) {
        const StoreUserValues = StackUserCriterios[id];
        StoreUserValues.forEach((item) => cellRow.push(item.criterion_value || "-"));

      } else {
        const userValues = await getUserCriterionValues2(user.id, workspaceCriteriaNames.concat(campaign_criterio));
        userValues.forEach((item) => cellRow.push(item.criterion_value || "-"));

        StackUserCriterios[id] = userValues; 
      }
      // logtime('end: user-criterio', user.id);
      // === criterios de usuario ===


      // === campaña ===
      const findCriterioFechaValue = StackUserCriterios[id].find( ({ criterion_name }) => criterion_name == headerIdCriterioFecha.name);
      cellRow.push(findCriterioFechaValue.criterion_value);

      cellRow.push(campaign.title);
      cellRow.push(campaign_criterio);
      if (VOTERS) {
        const findCriterioValue = StackUserCriterios[id].find( ({ criterion_name }) => criterion_name == campaign_criterio);
        campaign_criterio_value = findCriterioValue ? findCriterioValue.criterion_value : '-';
      }
      cellRow.push(campaign_criterio_value);
      // === campaña ===


      // === campaña etapas ===
      // logtime('end: user-etapas', user.id);

      let SAVE_STATES = 0;
      const { content, postulate, votation } = ARRAY_USERS_STAGES;

      let statusContent = '-';
      if(content !== '-') {
        const stContent = content.some((ele) => (ele.user_id == user.id));
              statusContent = stContent ? 'COMPLETO' : 'PENDIENTE';

        (stContent && SAVE_STATES++);
      }
      cellRow.push(statusContent);

      let statusPostulate = '-';
      if(postulate !== '-') {
        const stPostulate = postulate.some((ele) => (ele.user_id == user.id)); 
              statusPostulate = stPostulate ? 'COMPLETO' : 'PENDIENTE';
        
        (stPostulate && SAVE_STATES++);
      } 
      cellRow.push(statusPostulate);

      let statusVotation = '-';
      if(votation !== '-') {
        const stVotation = votation.some((ele) => (ele.user_id == user.id));
              statusVotation = stVotation ? 'COMPLETO' : 'PENDIENTE';

        (stVotation && SAVE_STATES++);
      } 
      cellRow.push(statusVotation);
      // === campaña etapas ===

      const campaign_porcent =  (SAVE_STATES * 100 / modalities.length); 
      cellRow.push(`${Math.round(campaign_porcent)}%`);
      // logtime('end: user-etapas', user.id);

      worksheet.addRow(cellRow).commit();

    }
    // === MATCH_USUARIOS - CAMPAÑA ===
  }

  logtime('end-reportes');

  if (worksheet._rowZero > 1){
    workbook.commit().then(() => {
      process.send(response({ createAt, modulo: 'Avance de campañas' }))
    })
  }  else {
    process.send({ alert: 'No se encontraron resultados' })
  }
}