const { con } = require('../db')
const sequelize = require('../sequelize.js');
const { Op } = require('sequelize');

const School = require('../models/School');
const SchoolWorkspace = require('../models/SchoolWorkspace');
const Course = require('../models/Course');
const CourseSchool = require('../models/CourseSchool');

exports.getSchoolStatesWorkspace = async (workspaceId, school_sts) => {
	
	const schools = await School.findAll({
		where: {
			active: {
				[Op.in] : school_sts
			}
		},
		include: [ 
			{
				model: SchoolWorkspace,
				where: {
					workspace_id: workspaceId
				}
			}
		]
	});

	return schools.map((el) => el.id); // only ids
	//return schools; // log
};

exports.getSchoolCoursesStates = async (schoolsIds, course_sts) => {

	const courses = await Course.findAll({
		where: {
			active: {
				[Op.in] : course_sts
			}
		},
		include: [ 
			{
				model: CourseSchool,
				where: {
					school_id: {
						[Op.in] : schoolsIds
					}
				}
			}
		]
	});
	
	return courses.map((el) => el.id); // only ids
	// return courses; // log
};

exports.BuildQueryAtDate = (date) => {

    // if not found date
    if(!date.length) 
    	return { 
    		where: {
    			certification_issued_at : {
    				[Op.not] : null
    			}
    		}
    	};

    const isRange = (date.length === 2);

    // if exist date or dates
    let modelQuery;

    if(isRange) {
        const [ firstDate, secondDate ] = date;

        modelQuery =  {
        	where: {
        		[Op.and] : [
    				sequelize.where(sequelize.fn('date', sequelize.col('certification_issued_at')), '>=', firstDate),
    				sequelize.where(sequelize.fn('date', sequelize.col('certification_issued_at')), '<=', secondDate)
	        	]
        	}
        };

    } else {
    	const [ firstDate ] = date;
        
        modelQuery = {
        	where: sequelize.where(sequelize.fn('date', sequelize.col('certification_issued_at')), '=', firstDate)
        };
    }

    return modelQuery;
};



