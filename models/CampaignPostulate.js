const { 
    Model, 
    DataTypes: { STRING, INTEGER } 
    } = require('sequelize');

const sequelize = require('../sequelize.js')
const CampaignSummoned = require('./CampaignSummoned');

class CampaignPostulate extends Model {
}

CampaignPostulate.init({
    summoned_id: INTEGER,
    user_id: INTEGER,
    sustent: STRING,
    state: INTEGER
},{
    sequelize,
    timestamps: false,
    tableName: 'campaign_postulates'
});

CampaignPostulate.belongsTo(CampaignSummoned,{
    foreignKey: 'summoned_id',
    sourceKey: 'id',
});
module.exports = CampaignPostulate;