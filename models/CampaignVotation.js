const { 
        Model, 
        DataTypes: { INTEGER, STRING } 
      } = require('sequelize');

const sequelize = require('../sequelize.js');
const CampaignSummoned = require('./CampaignSummoned');

class CampaignVotation extends Model {
}

CampaignVotation.init({
    summoned_id: INTEGER,
    user_id: INTEGER,
},{
    sequelize,
    timestamps: false,
    tableName: 'campaign_votations'
})

CampaignVotation.belongsTo(CampaignSummoned, {
    foreignKey: 'summoned_id',
    sourceKey: 'id',
});

module.exports = CampaignVotation;