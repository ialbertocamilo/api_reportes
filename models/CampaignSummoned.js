const { 
    Model, 
    DataTypes: { STRING, INTEGER } 
    } = require('sequelize');

const sequelize = require('../sequelize.js')

class CampaignSummoned extends Model {
}

CampaignSummoned.init({
    campaign_id: INTEGER,
    user_id: INTEGER,
    answer: STRING
},{
    sequelize,
    timestamps: false,
    tableName:'campaign_summoneds'
});

module.exports = CampaignSummoned;