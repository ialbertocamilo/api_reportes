const { Op } = require('sequelize');
const sequelize = require('sequelize');

// Usuarios 
const User = require('../models/User');
const CriterionValue = require('../models/CriterionValue');
const CriterionValueUser = require('../models/CriterionValueUser');
const { getCriterioValuesByCriterioId } = require('./Criterios');
const { pluck } = require('./Helper');
// const Modulo = require('../models/Modulo'); // modelo fuera
// // Usuarios 

// Summoneds - Postulate
const CampaignSummoned = require('../models/CampaignSummoned');
const CampaignPostulate = require('../models/CampaignPostulate');
const CampaignVotation = require('../models/CampaignVotation');
// Summoneds - Postulate

// Helpers
const { helperPlusMonthsDateNow,
        helperGetMergeNumbers,
        helperGetValueByKey } = require('./helper');
// Helpers

// campañas
const Campaign = require('../models/Campaign');
const CampaignModule = require('../models/CampaignModule');
const CampaignRequirement = require('../models/CampaignRequirement');
// campañas

const MODALITIES_GROUPS = {
    0:{
        etapas: [
            { label:'CONTENIDO', key: 'content' },
            { label:'POSTULACION',key: 'postulate' },
            { label:'VOTACION', key: 'votation' }
        ]
    },
    1:{
        etapas: [
            { label:'CONTENIDO', key: 'content' },
            { label:'POSTULACION', key: 'postulate' },
        ]
    },
    2:{
        etapas: [
            { label:'POSTULACION',key: 'postulate' },
            { label:'VOTACION', key: 'votation' }
        ]
    },
    3:{
        etapas: [
            { label:'POSTULACION', key: 'postulate' },
        ]
    }   
};

const CHECK_MODALITIES = {
    async content(campaign_id) {
        return await CampaignSummoned.findAll({
            where: {
                campaign_id,
            }
        });
    },
    async postulate(campaign_id) {
        return await CampaignPostulate.findAll({
            include: [
                {
                    model: CampaignSummoned,
                    where:{
                        campaign_id
                    }
                }
            ]
        });
    },
    async votation(campaign_id) {
        return await CampaignVotation.findAll({
            include:[
                {
                    model: CampaignSummoned,
                    where: {
                        campaign_id
                    }
                }
            ]
        });
    }

   /* async content(campaign_id, user_id) {
        const state = await CampaignSummoned.findAll({
            where: {
                campaign_id,
                user_id: user_id
            }
        });

        // console.log('content', { state, user_id, id_announcement });
        return (state.length) ? 'COMPLETADO' : 'PENDIENTE';
    },
    async postulate(campaign_id, user_id) {
        const state = await CampaignPostulate.findAll({
            where: {
                user_id: user_id
            },
            include: [
                {
                    model: CampaignSummoned,
                    where:{
                        campaign_id
                    }
                }
            ]
        });

        // console.log('postulate', { state, user_id, id_announcement });
        return (state.length) ? 'COMPLETADO' : 'PENDIENTE';
    },
    async votation(campaign_id, user_id) {
        const state = await CampaignVotation.findAll({
            where:{
                user_id: user_id
            },
            include:[
                {
                    model: CampaignSummoned,
                    where: {
                        campaign_id
                    }
                }
            ]
        });

        // console.log('votation', { state, user_id, id_announcement });
        return (state.length) ? 'COMPLETADO' : 'PENDIENTE';
    }*/
}

const calcDateTime = (condition, months) => {
    const operators = ['>=','<='];
    const operator = operators[condition];

    return { operator, months };
}

async function getUsersByDateAdmision(operator, calc_date, requirement_static, req_data) {

    const { criterio_id_fecha_inicio_reconocimiento, 
            subworkspaces_ids, 
            workspaceId } = requirement_static;

    let query = null;

    if (req_data == undefined) {
        query = null;
    }else {
        const { criterio_id } = req_data;
        let criterio_values; 

        // if (req_data.criterio_values) {
        if (req_data.criterio_values) {
            criterio_values = req_data.criterio_values;
        }else {
            const res_criterio_values = await getCriterioValuesByCriterioId(criterio_id);
            criterio_values = pluck(res_criterio_values, 'id');
        }

        query = criterio_values;
    }

    // condicion Modelo
    const conditionModel = (query == null) ? 
            {
                model: CriterionValue,
                through: CriterionValueUser,
                where: [
                    {
                        criterion_id: criterio_id_fecha_inicio_reconocimiento,
                    },
                    sequelize.literal(`value_date ${operator} "${calc_date}"`),
                ]
            } 
            : 
            {
                model: CriterionValue,
                through: CriterionValueUser,
                required: true,
                where: [
                    {  criterion_id: criterio_id_fecha_inicio_reconocimiento },
                       sequelize.literal(`value_date ${operator} "${calc_date}"`),
                       sequelize.literal(`EXISTS (SELECT * FROM criterion_values INNER JOIN criterion_value_user ON criterion_values.id = criterion_value_user.criterion_value_id WHERE users.id = criterion_value_user.user_id AND id IN (${query.join(',')}) AND criterion_values.deleted_at IS NULL)`)
                ]
            };

    const usersAdmisions = await User.findAll({
        where: {
            active: 1,
            subworkspace_id: {
                [Op.in]: subworkspaces_ids
            }
        },
        include: conditionModel 
    });

    // console.log('usersAdmisions', {count: usersAdmisions.length} );
    return usersAdmisions;
}

async function getUsersAdmisions(typeRequirement, criterio_id_fecha) {
    const { 
        req_date: {
            operator, months
        },
        req_data // null - object {  }
    } = typeRequirement;

    const calc_date = helperPlusMonthsDateNow(months);
    return await getUsersByDateAdmision(operator, calc_date, criterio_id_fecha, req_data);
}

async function getCampaignUsersRequirement(requirements, requirement_static) {
    const { keys } = Object;
    if( !(keys(requirements).length) ) return []; // no hay requisitos

    const { POSTULATES, VOTERS } = requirements;
    let user_finally = [];

    // === para campañas copia
    if (POSTULATES) {
        if(POSTULATES.req_date.operator == null || 
           POSTULATES.req_date.months == null ) return [];
    }

    if(VOTERS) {
        if(VOTERS.req_date.operator == null || 
           VOTERS.req_date.months == null) return [];
    }
    // === para campañas copia

    if(POSTULATES && VOTERS) {
        user_finally = await getUsersAdmisions(VOTERS, requirement_static);
    } else {
        user_finally = await getUsersAdmisions(POSTULATES, requirement_static);
    }

    return user_finally;
}

async function getCampaignRequirements(requirements) {

    const Callbacks = {
        POSTULATES(requirement) {
            const { criterio_id, condition, value } = requirement;
            if(!criterio_id) return { req_date: calcDateTime(condition, value) }
        },
        VOTERS(requirement) {
            let { criterio_id, condition, value } = requirement;
            if(!criterio_id) return { req_date: calcDateTime(condition, value) }; 

            value =  (!value) ? [] : value.split(','); // en caso sea 'null'
            return { req_data: { criterio_id, criterio_values: value } }
        }
    }

    let sameCriterio = true;
    let SAVE_REQUIREMENT = {};

    for(requirement of requirements) {
        const { type } = requirement;

        if (SAVE_REQUIREMENT[type]) {
            const response = Callbacks[type](requirement);
            SAVE_REQUIREMENT[type] = { ...SAVE_REQUIREMENT[type], ...response };
        } else {
            SAVE_REQUIREMENT[type] = Callbacks[type](requirement); // callback type  
        }
    }
    
    // con los mismo criterios de 'votantes' a 'postulantes'
    const { POSTULATES, VOTERS } = SAVE_REQUIREMENT
    if (VOTERS && sameCriterio) SAVE_REQUIREMENT.POSTULATES = { ...POSTULATES, ...VOTERS };
    
    return SAVE_REQUIREMENT;
}

async function getCampaigns(campaign_ids, campaign_estados) {

    return await Campaign.findAll({
        where: {
            id: {
                [Op.in]: campaign_ids
            },
            state: {
                [Op.in]: campaign_estados
            },
        },
        include: [ 
            { model: CampaignModule }, 
            { model: CampaignRequirement } 
        ] // modulo - requerimiento
    });
}

// === votaciones ===
async function getCampaignsBySubworspaceId(mods) {
    const array_subworkspaces = mods.split(',');

    const campaigns = await Campaign.findAll({
        attributes: [
            'id',
            'title'
        ],
        where:{
            deleted_at:{
                [Op.is]: null
            }
        },
        include:[
        {
            model: CampaignModule,
            where: {
                module_id: {
                    [Op.in]: array_subworkspaces
                }
            },
            required: true
        },
        {
            model: CampaignRequirement,
            where: {
                [Op.or]:[
                {
                    type: 'VOTERS',
                    criterio_id: {
                        [Op.not]: null
                    }
                },
                {            
                    type: 'POSTULATES',
                    condition:{
                        [Op.not]: null
                    },
                    value:{
                        [Op.not]: null
                    }
                }]
            }
        }],
        order: [
            ['created_at', 'desc']
        ],
    });

    return campaigns.map( (campaign) => {
        const { id, title } = campaign.dataValues;
        return { id, title };
    });
}

module.exports = {
    // constants
    MODALITIES_GROUPS,
    CHECK_MODALITIES,

    // functions
    getCampaigns,
    getCampaignRequirements,
    getCampaignUsersRequirement,

    // filters
    getCampaignsBySubworspaceId
}









