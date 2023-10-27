const { 
    Model, 
    DataTypes: { STRING, INTEGER } 
    } = require('sequelize');

const sequelize = require('../sequelize.js')
const CampaignModule = require('./CampaignModule.js');
const CampaignRequirement = require('./CampaignRequirement.js');

class Campaign extends Model {
}

Campaign.init({
    title: STRING,
    description: STRING,
    stage_id: INTEGER,
    stage_content: INTEGER,
    stage_postulate: INTEGER,
    stage_votation: INTEGER,
    deleted_at: STRING,
},{
    sequelize,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'campaigns'
});

Campaign.hasMany(CampaignModule, {
    foreignKey:'campaign_id',
    sourceKey:'id',
});

Campaign.hasMany(CampaignRequirement, {
    foreignKey:'campaign_id',
    sourceKey:'id',
});

module.exports = Campaign;