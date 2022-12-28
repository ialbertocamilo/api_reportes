const moment = require("moment");
const { con } = require("../db");
const { loadTopicsByCourseId, getCourseStatusId } = require("./CoursesTopicsHelper");
const {
  groupArrayOfObjects,
  uniqueElements,
  pluckUnique,
  logtime,
  pluck,
} = require("./Helper");

exports.loadUsersSegmented = async (course_id) => {
  // select `id` from `users`
  // inner join `criterion_value_user` as `cvu1` on `users`.`id` = `cvu1`.`user_id` and `cvu1`.`criterion_value_id` in (?)
  // inner join `criterion_value_user` as `cvu46` on `users`.`id` = `cvu46`.`user_id` and `cvu46`.`criterion_value_id` in (?)
  // where `active` = ?
  const segments = await con("segments_values as sv")
    .select(
      "sv.criterion_id",
      "sv.starts_at",
      "sv.finishes_at",
      "sv.segment_id",
      "sv.criterion_value_id",
      "t.code"
    )
    .join("segments as sg", "sg.id", "sv.segment_id")
    .join("criteria as c", "c.id", "sv.criterion_id")
    .join("taxonomies as t", "t.id", "c.field_id")
    .where("sg.model_type", "App\\Models\\Course")
    .where("sg.model_id", course_id)
    .where("sg.deleted_at", null)
    .where("sv.deleted_at", null);
  const segments_groupby = groupArrayOfObjects(
    segments,
    "segment_id",
    "get_array"
  );
  let users = [];
  for (segment of segments_groupby) {
    const grouped = groupArrayOfObjects(segment, "criterion_id", "get_array");
    let join_criterions_values_user = "";
    grouped.forEach((values, idx) => {
      if (values[0].code != "date") {
        const criterios_id = pluckUnique(
          values,
          "criterion_value_id"
        ).toString();
        join_criterions_values_user += `inner join criterion_value_user as cvu${idx} on users.id = cvu${idx}.user_id and cvu${idx}.criterion_value_id in (${criterios_id}) `;
      } else {
        let select_date = "select id from criterion_values where ";
        values.forEach((value, index) => {
          const starts_at = moment(value.starts_at).format("YYYY-MM-DD");
          const finishes_at = moment(value.finishes_at).format("YYYY-MM-DD");
          select_date += ` ${index > 0 ? "or" : ""
            } value_date between '${starts_at}' and '${finishes_at}' and criterion_id=${value.criterion_id
            }`;
        });
        select_date += " and deleted_at is null";
        join_criterions_values_user += `inner join criterion_value_user as cvu${idx} on users.id = cvu${idx}.user_id and cvu${idx}.criterion_value_id in (${select_date}) `;
      }
    });
    const [rows] =
      await con.raw(`select users.id , users.name,users.lastname,users.surname,users.email, users.document ,sc.grade_average,sc.advanced_percentage,sc.status_id,sc.created_at as sc_created_at from users
        LEFT OUTER join summary_courses sc on sc.user_id = users.id and sc.course_id = ${course_id}
        ${join_criterions_values_user} 
        where users.active=1 
        and users.deleted_at is null`);
    if (rows.length > 0) {
      users = [...users, ...rows];
    }
  }
  return uniqueElements(users, "id");
};

exports.loadUsersSegmentedv2 = async (
  course_id,
  modules = [],

  start_date = null,
  end_date = null,
  activeUsers = false,
  inactiveUsers = false,
  areas
) => {
  // logtime(`INICIO METHOD : [loadUsersSegmentedv2]`)
  const segments = await con("segments_values as sv")
    .select(
      "sv.criterion_id",
      "sv.starts_at",
      "sv.finishes_at",
      "sv.segment_id",
      "sv.criterion_value_id",
      "t.code"
    )
    .join("segments as sg", "sg.id", "sv.segment_id")
    .join("criteria as c", "c.id", "sv.criterion_id")
    .join("taxonomies as t", "t.id", "c.field_id")
    .where("sg.model_type", "App\\Models\\Course")
    .where("sg.model_id", course_id)
    .where("sg.deleted_at", null)
    .where("sv.deleted_at", null);
  const segments_groupby = groupArrayOfObjects(
    segments,
    "segment_id",
    "get_array"
  );
  let users = [];

  for (let segment of segments_groupby) {
    const grouped = groupArrayOfObjects(segment, "criterion_id", "get_array");
    let join_criterions_values_user = "";
    grouped.forEach((values, idx) => {
      if (values[0].code != "date") {
        const criterios_id = pluckUnique(
          values,
          "criterion_value_id"
        ).toString();
        join_criterions_values_user += `inner join criterion_value_user as cvu${idx} on u.id = cvu${idx}.user_id and cvu${idx}.criterion_value_id in (${criterios_id})`;
        // console.log('criterios_inner', join_criterions_values_user);
      } else {
        let select_date = "select id from criterion_values where ";
        values.forEach((value, index) => {
          const starts_at = moment(value.starts_at).format("YYYY-MM-DD");
          const finishes_at = moment(value.finishes_at).format("YYYY-MM-DD");
          select_date += ` ${index > 0 ? "or" : ""
            } value_date between '${starts_at}' and '${finishes_at}' and criterion_id=${value.criterion_id
            }`;
        });
        select_date += " and deleted_at is null";
        join_criterions_values_user += `inner join criterion_value_user as cvu${idx} on u.id = cvu${idx}.user_id and cvu${idx}.criterion_value_id in (${select_date}) `;
      }
    });

    // USERS FILTERS
    const queryJoin = start_date || end_date ? `INNER` : `LEFT OUTER`;
    const start_date_query = start_date
      ? ` and date(sc.created_at) >= '${start_date}'`
      : ``;
    const end_date_query = end_date
      ? ` and date(sc.created_at) <= '${end_date}'`
      : ``;

    const modules_query =
      modules && modules.length > 0
        ? `and u.subworkspace_id in (${modules.join()})`
        : ``;

    const user_active_query = activeUsers ? ` and u.active = 1 ` : ``;
    const user_inactive_query = inactiveUsers ? ` and u.active = 0 ` : ``;
    

    let join_criterions_values_user_area = '';
    let where_criterions_values_user_area = '';

    if(areas.length) {
        join_criterions_values_user_area += ` 
          inner join criterion_value_user cvu 
            on cvu.user_id = u.id
          inner join criterion_values cv 
            on cvu.criterion_value_id = cv.id `;
    
        where_criterions_values_user_area += ` 
          and cvu.criterion_value_id in ( ${areas.join()} )`
    }
    // console.log({
    //   join_criterions_values_user,
    //   queryJoin,
    //   start_date_query,
    //   end_date_query,
    //   modules_query,
    //   user_active_query,
    //   user_inactive_query,
    // });

    let query = `
        select 
            u.id, u.name,
            u.lastname, u.surname,
            u.email, u.document, 
            u.active, u.last_login,

            sc.grade_average, sc.advanced_percentage,
            sc.status_id, sc.created_at as sc_created_at,
            sc.views as course_views, sc.passed as course_passed, 
            sc.assigned, sc.completed,
            sc.last_time_evaluated_at, sc.restarts,
            sc.taken, sc.reviewed,
            sc.status_id as course_status_id

        from users u
        
          ${queryJoin} join summary_courses sc on sc.user_id = u.id and sc.course_id = ${course_id} 
          ${start_date_query} ${end_date_query}
          LEFT OUTER join taxonomies t1 on t1.id = sc.status_id
          ${join_criterions_values_user} 

          ${join_criterions_values_user_area}

        where 
          u.deleted_at is null
          ${user_active_query} ${user_inactive_query}
          ${modules_query} 

          ${where_criterions_values_user_area}
          `

    // logtime(query);
    const [rows] = await con.raw(query);

    if (rows.length > 0) {
      users = [...users, ...rows];
    }
  }
  // logtime(`FIN METHOD : [loadUsersSegmentedv2]`)

  return uniqueElements(users, "id");
};


exports.loadUsersSegmentedv2WithSummaryTopics = async (
  course_id,
  modules = [],
  start_date = null,
  end_date = null,
  activeUsers = false,
  inactiveUsers = false
) => {
  // logtime(`INICIO METHOD : [loadUsersSegmentedv2]`)
  const segments = await con("segments_values as sv")
    .select(
      "sv.criterion_id",
      "sv.starts_at",
      "sv.finishes_at",
      "sv.segment_id",
      "sv.criterion_value_id",
      "t.code"
    )
    .join("segments as sg", "sg.id", "sv.segment_id")
    .join("criteria as c", "c.id", "sv.criterion_id")
    .join("taxonomies as t", "t.id", "c.field_id")
    .where("sg.model_type", "App\\Models\\Course")
    .where("sg.model_id", course_id)
    .where("sg.deleted_at", null)
    .where("sv.deleted_at", null);
  const segments_groupby = groupArrayOfObjects(
    segments,
    "segment_id",
    "get_array"
  );
  let users = [];
  for (let segment of segments_groupby) {
    const grouped = groupArrayOfObjects(segment, "criterion_id", "get_array");
    let join_criterions_values_user = "";
    grouped.forEach((values, idx) => {
      if (values[0].code != "date") {
        const criterios_id = pluckUnique(
          values,
          "criterion_value_id"
        ).toString();
        join_criterions_values_user += `inner join criterion_value_user as cvu${idx} on u.id = cvu${idx}.user_id and cvu${idx}.criterion_value_id in (${criterios_id}) `;
      } else {
        let select_date = "select id from criterion_values where ";
        values.forEach((value, index) => {
          const starts_at = moment(value.starts_at).format("YYYY-MM-DD");
          const finishes_at = moment(value.finishes_at).format("YYYY-MM-DD");
          select_date += ` ${index > 0 ? "or" : ""
            } value_date between '${starts_at}' and '${finishes_at}' and criterion_id=${value.criterion_id
            }`;
        });
        select_date += " and deleted_at is null";
        join_criterions_values_user += `inner join criterion_value_user as cvu${idx} on u.id = cvu${idx}.user_id and cvu${idx}.criterion_value_id in (${select_date}) `;
      }
    });

    // USERS FILTERS
    const queryJoin = start_date || end_date ? `INNER` : `LEFT OUTER`;
    const start_date_query = start_date
      ? ` and date(sc.created_at) >= '${start_date}'`
      : ``;
    const end_date_query = end_date
      ? ` and date(sc.created_at) <= '${end_date}'`
      : ``;

    const modules_query =
      modules && modules.length > 0
        ? `and u.subworkspace_id in (${modules.join()})`
        : ``;

    const user_active_query = activeUsers ? ` and u.active = 1 ` : ``;
    const user_inactive_query = inactiveUsers ? ` and u.active = 0 ` : ``;
    // console.log({
    //   join_criterions_values_user,
    //   queryJoin,
    //   start_date_query,
    //   end_date_query,
    //   modules_query,
    //   user_active_query,
    //   user_inactive_query,
    // });

    /**
     * Comprobar que retorne 
     * User Data - Summar Course Data (data o nulo) - Summary Topic Data (data o nulo)
     */
    const [rows] = await con.raw(`
        select 
            u.id, u.name,u.lastname,u.surname,u.email, u.document, u.active, u.last_login,

            sc.grade_average,sc.advanced_percentage,sc.status_id,sc.created_at as sc_created_at,
            sc.views as course_views, sc.passed as course_passed, sc.assigned, sc.completed,
            sc.last_time_evaluated_at, sc.restarts, sc.taken, sc.reviewed,

            sc.status_id as course_status_id

        from users u
        
            ${queryJoin} join summary_courses sc on sc.user_id = u.id and sc.course_id = ${course_id} 
            
            
            INNER join topics t on t.course_id = sc.course_id
            LEFT OUTER JOIN summary_topics st on st.topic_id = t.id


            ${start_date_query} ${end_date_query}

            LEFT OUTER join taxonomies t1 on t1.id = sc.status_id

            ${join_criterions_values_user} 

        where 
            u.deleted_at is null
            ${user_active_query} ${user_inactive_query}
            ${modules_query}
        `);
    if (rows.length > 0) {
      users = [...users, ...rows];
    }
  }
  // logtime(`FIN METHOD : [loadUsersSegmentedv2]`)

  return uniqueElements(users, "id");
};


exports.loadCourses = async (
  { cursos = [], 
    escuelas = [],
    tipocurso }, workspaceId) => {

  let query = `
    select  
    
      cs.course_id,
      c.name as course_name,
      s.name as school_name,
      c.active as course_active,
      tx.name as course_type

    from course_school as cs

    inner join courses as c 
      on c.id = cs.course_id
    inner join schools as s
      on s.id = cs.school_id
    inner join taxonomies as tx
      on tx.id = c.type_id 
    inner join school_workspace as sw
      on sw.school_id = s.id

    where c.active = 1 
    and sw.workspace_id = ${workspaceId}  
    and c.deleted_at is null 
  `;

  if(cursos.length) query += ` and cs.course_id in (${cursos.join()})`;
  if(escuelas.length) query += ` and cs.school_id in (${escuelas.join()})`;
  
  if(!tipocurso) query += ` and tx.code not in ('free')`;
  
  query += ` group by cs.course_id`;

  const [rows] = await con.raw(query);

  return rows;
};


exports.loadCoursesV2 = async ({
  workspaceId = null,
  schools = [],
  courses = [],
  topics = []
}) => {

  schools = schools.filter((el) => el != null);
  courses = courses.filter((el) => el != null);
  topics = topics.filter((el) => el != null);

  let query = `
    SELECT 

      c.name as course_name,
      c.id as course_id

    FROM courses as c 
  `;


  // JOIN statements
  if (workspaceId)
    query += `INNER JOIN course_workspace as cw ON cw.course_id = c.id `;

  if (schools.length > 0)
    query += `INNER JOIN course_school as cs ON cs.course_id = c.id `;

  if (topics.length > 0)
    query += `INNER JOIN topics as t ON t.course_id = c.id `;

  // WHERE statements
  query += `WHERE c.deleted_at IS NULL `;

  if (workspaceId)
    query += `AND cw.workspace_id = ${workspaceId} `;

  if (schools.length > 0)
    query += `AND cs.school_id IN (${schools.join(',')}) `;

  if (courses.length > 0)
    query += `AND c.id IN (${courses.join(',')}) `;

  if (topics.length > 0)
    query += `AND t.course_id IN (${topics.join(',')}) `;


  // console.log({ query });
  const [rows] = await con.raw(query);

  return rows;
}