const { con } = require('../db')
const knex = require('../db').con
module.exports = {
  async datosIniciales(workspaceId) {
    const modules = await this.cargarModulos(workspaceId)
    const admins = await this.cargarAdmins(workspaceId)
    return {
      modules,
      admins,
      // vademecums
    }
  },

  /**
   * Load subworkspaces from workspace
   *
   * @param workspaceId
   * @returns {Promise<*>}
   */
  async cargarModulos(workspaceId) {
    const [rows] = await con.raw(`
        select id, name, slug
        from workspaces 
        where 
            parent_id = :workspaceId and active = 1
    `,
      { workspaceId }
    )

    return rows
  },

  async cargarAdmins(workspaceId) {
    const adminRoleId = 3
    const [rows] = await con.raw(`
        select
          u.id, u.name
        from
            users u inner join assigned_roles ar on ar.entity_id = u.id
        where
            ar.role_id = :adminRoleId and
            u.active = 1 and
            ar.scope = :workspaceId
      `,
      { workspaceId, adminRoleId })
    return rows
  },

  async cargarVademecums(workspaceId) {

    const [subrows] = await con.raw(`select 
                                      criterion_value_id 
                                    from 
                                      workspaces 
                                    where 
                                      parent_id = :workspaceId`, { workspaceId });
    let ids = [];
    for (const val of subrows) {
      ids.push(val.criterion_value_id);
    }

    const [rows] = await con.raw(`
          select 
            v.id, v.name 
          from 
            vademecum  as v 
          inner join 
            vademecum_module as vm 
            on vm.vademecum_id = v.id
          
          where vm.module_id in(:ids) 
          group by v.id`, { ids });

    return rows;
  },

  /**
   * Load workspace's courses
   * @param schoolId
   * @returns {Promise<*>}
   */
  async loadSchoolCourses(schoolId) {
    const [rows] = await con.raw(`
      select
        c.*
      from courses c inner join course_school cs on c.id = cs.course_id
      where cs.school_id = :schoolId and 
            c.active = 1
    `, { schoolId }
    )
    return rows
  },
  /**
   * Load courses from several schools
   * @param schoolsId
   * @returns {Promise<*>}
   */
  async loadCoursesFromSchools(schoolsId) {
    const [rows] = await con.raw(`
      select
        c.*
      from courses c inner join course_school cs on c.id = cs.course_id
      where cs.school_id in (:schoolIds) and
          c.active = 1 and c.deleted_at is null
    `, { schoolIds: schoolsId }
    )
    return rows
  },
  /**
   * Load course's topics
   * @param courseId
   * @returns {Promise<*>}
   */
  async loadCourseTopics(courseId) {
    const [rows] = await con.raw(`
      select
        *
      from topics
      where course_id = :courseId
    `, { courseId }
    )
    return rows
  },
  /**
   * Load workspace's courses
   * @param workspaceId
   * @returns {Promise<*>}
   */
  async loadWorkspaceSchools(workspaceId) {
    const [rows] = await con.raw(`
      select
        s.*
      from schools s inner join school_workspace sw on s.id = sw.school_id
      where sw.workspace_id = :workspaceId and s.active = 1
    `, { workspaceId }
    )
    return rows
  },
  async loadWorkspaceJobPositions(workspaceId) {
    const [rows] = await con.raw(`
      select
        distinct(cv.value_text) name,
            c.id criterion_id
        from
            criterion_values cv
            inner join criteria c on c.id = cv.criterion_id
            inner join criterion_workspace cw on cw.criterion_id = c.id
            inner join workspaces w on w.id = cw.workspace_id
        where
        c.code = 'position_name' and
        w.id = :workspaceId
        order by name
    `, { workspaceId }
    )
    return rows
  },
  /**
   * Load checklist from specific course
   * @param courseId
   * @returns {Promise<*>}
   */
  async loadCourseChecklists(courseId) {
    const [rows] = await con.raw(`
      select
        c.id,
        c.title
      
      from
          checklist_relationships cr 
            inner join checklists c on c.id = cr.checklist_id
      where
          cr.course_id = :courseId and
          c.active = 1
      
      group by c.id
    `, { courseId })

    return rows
  },





  /*
   * Primarios
   */
  async cambiaModuloCargaCarrera(mod) {
    return mod ? knex('carreras').select('id', 'nombre').where('config_id', mod)
      : knex('carreras').select('id', 'nombre')
  },
  async cambiaModuloCargaEscuela(mod) {
    const [rows] = await con.raw(`SELECT a.id, a.nombre, a.modalidad, a.descripcion
        FROM categorias AS a
        INNER JOIN cursos AS c ON c.categoria_id = a.id
        INNER JOIN posteos AS p ON p.curso_id = c.id
        WHERE a.config_id = ${mod}
        AND a.estado = 1
        AND c.estado = 1
        AND p.estado = 1
        GROUP BY c.categoria_id
        ORDER BY a.nombre`)
    // Si la modalidad es `extra`, entonces le adjunta una descripcion a su nombre
    rows.forEach((el) => {
      if (el.modalidad == 'extra') {
        el.nombre = el.nombre + ` (${el.descripcion})`
      }
    })
    //
    return rows
  },

  async cambiaEscuelaCargaCurso(mod, esc) {
    // ! Query Antiguo >>>
    // const [rows] = await con.raw(`SELECT c.id, c.nombre FROM cursos AS c
    //     INNER JOIN posteos AS p ON p.curso_id = c.id
    //     WHERE c.config_id = ${mod}
    //     AND c.categoria_id = ${esc}
    //     AND c.estado = 1
    //     AND p.estado = 1
    //     GROUP BY p.curso_id
    //     ORDER BY c.nombre`)
    // ! Query NuevoD >>>
    console.log('Modulo : ', mod);
    // return false
    return knex('cursos').select('id', 'nombre').where('config_id', mod).andWhere('categoria_id', esc)
  },
  async cambiaEscuelaCargaCursoAbierta({ mod, esc }) {
    let query = ' WHERE 1 '
    query += mod ? ' AND c.config_id = ' + mod : ''
    query += esc ? ' AND c.categoria_id = ' + esc : ''
    const [rows] = await con.raw(`SELECT c.id, c.nombre FROM cursos AS c
    INNER JOIN posteos AS p ON p.curso_id = c.id
    ${query}
    AND p.evaluable = 'si'
        AND p.tipo_ev = 'abierta'
        AND c.estado = 1
        AND p.estado = 1
        GROUP BY p.curso_id
        ORDER BY c.nombre`)
    return rows
  },
  //
  async cambiaCursoCargaTema({ esc, cur }) {
    let query = " WHERE estado = 1 AND tipo_ev = 'calificada'"
    query += esc ? ' AND categoria_id = ' + esc : ''
    query += cur ? ' AND curso_id = ' + cur : ''
    console.log(`SELECT id, nombre FROM posteos ${query}`)
    const [rows] = await con.raw(`SELECT id, nombre FROM posteos ${query}`)
    return rows
  },
  async cambiaCursoCargaTemaAbierta({ esc, cur }) { // Eva abiertas
    let query = " WHERE estado = 1 AND tipo_ev = 'abierta'"
    query += esc ? ' AND categoria_id = ' + esc : ''
    query += cur ? ' AND curso_id = ' + cur : ''
    console.log(`SELECT id, nombre FROM posteos ${query}`)
    const [rows] = await con.raw(`SELECT id, nombre FROM posteos ${query}`)
    return rows
  },

  async cambiaCursoCargaTemaTodos({ esc, cur }) {
    let query = ' WHERE estado = 1'
    query += esc ? ' AND categoria_id = ' + esc : ''
    query += cur ? ' AND curso_id = ' + cur : ''
    console.log(`SELECT id, nombre FROM posteos ${query}`)
    const [rows] = await con.raw(`SELECT id, nombre FROM posteos ${query}`)
    return rows
  },
  /*
    Secundarios
  */
  async cargarGrupos(mod) {
    let query = ''
    query = mod ? 'where u.config_id =' + mod : ''

    const [rows] = await con.raw(`SELECT u.grupo, CONCAT(u.grupo, ' (', a.etapa, ')') titulo FROM usuarios u
        INNER JOIN ab_config AS a ON a.id = u.config_id
         ${query}
        GROUP BY u.grupo
        ORDER BY u.grupo`)
    return rows
  },

  async cargarCarreras(mod) {
    let query = ''
    query = mod ? 'and c.config_id =' + mod : ''
    console.log('query carreras ', query)
    const [rows] = await con.raw(`SELECT c.id, CONCAT(c.nombre, ' (', a.etapa, ')') titulo FROM carreras AS c
        INNER JOIN ab_config AS a ON a.id = c.config_id
        WHERE c.estado = 1 ${query}
        ORDER BY c.nombre`)
    return rows
  },

  async cargarCiclos(mod) {
    let query = ''
    query = mod ? 'and r.config_id =' + mod : ''

    const [rows] = await con.raw(`SELECT c.id, CONCAT(c.nombre, ' (', a.etapa, ')') titulo FROM ciclos AS c
    INNER JOIN carreras AS r ON r.id = c.carrera_id
    INNER JOIN ab_config AS a ON a.id = r.config_id
    WHERE c.estado = 1 AND r.estado = 1 ${query}
    GROUP BY c.secuencia, r.config_id
    ORDER BY c.nombre`)
    return rows
  },

  // !Nuevos filtros >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  async cambiaModulosCargaEscuela(mods) {
    if (!mods || !mods[0]) return false
    mods = mods.map(el => `${el}`).join(",")
    const [rows] = await con.raw(`SELECT a.id, CONCAT(m.codigo,' - ',a.nombre) as nombre, a.modalidad, a.descripcion, m.etapa
        FROM categorias AS a
        INNER JOIN cursos AS c ON c.categoria_id = a.id
        INNER JOIN posteos AS p ON p.curso_id = c.id
        INNER JOIN ab_config as m on a.config_id = m.id
        WHERE a.config_id in (${mods})
        AND a.estado = 1
        AND c.estado = 1
        AND p.estado = 1
        GROUP BY c.categoria_id
        ORDER BY a.nombre`)
    // Si la modalidad es `extra`, entonces le adjunta una descripcion a su nombre
    rows.forEach((el) => {

      if (el.modalidad == 'extra') {
        el.nombre = el.nombre + ` (${el.descripcion})`
      }
      // else {
      //   let SplitModulo = el.etapa.split(' ')
      //   let ModuloIniciales = ''
      //   SplitModulo.forEach(el => ModuloIniciales += el.substring(0, 1))
      //   el.nombre = ModuloIniciales + ' - ' + el.nombre
      // }

    })
    //
    return rows
  },
  async cambiaEscuelaCargaCursoAbierta({ mods, escs }) {
    if (!mods || !escs) return false
    let Where = `WHERE c.config_id in (${mods}) AND c.categoria_id in (${escs})`
    const [rows] = await con.raw(`SELECT c.id, CONCAT(m.codigo,' - ',c.nombre) as nombre FROM cursos AS c
    INNER JOIN posteos AS p ON p.curso_id = c.id
    INNER JOIN ab_config as m on m.id=c.config_id
    ${Where}
    AND p.evaluable = 'si'
    AND p.tipo_ev = 'abierta'
    AND c.estado = 1
    AND p.estado = 1
    GROUP BY p.curso_id
    ORDER BY c.nombre`)
    return rows
  },
  async cambiaCursoCargaTemaAbierta({ escs, curs }) { // Evaluaciones Abiertas
    let temasAb = await knex('posteos').select('posteos.id', 'posteos.nombre', 'ab_config.codigo')
      .join('cursos', 'posteos.curso_id', 'cursos.id')
      .join('ab_config', 'cursos.config_id', 'ab_config.id')
      .whereIn('posteos.categoria_id', escs).whereIn('posteos.curso_id', curs)
      .andWhere('tipo_ev', 'abierta')
    temasAb.forEach(obj => obj.nombre = obj.codigo + ' - ' + obj.nombre)
    return temasAb
  },
  async cambiaEscuelasCargaCursos({ mods, escs }) {
    let cursos = await knex('cursos').select('cursos.id', 'cursos.nombre', 'ab_config.codigo')
      .join('ab_config', 'cursos.config_id', 'ab_config.id')
      .whereIn('config_id', mods)
      .whereIn('categoria_id', escs)
    cursos.forEach(obj => obj.nombre = obj.codigo + ' - ' + obj.nombre)
    return cursos
  },
  async cambiaCursoCargaTemas({ escs, curs }) {
    //// return knex('posteos').select('id', 'nombre').whereIn('categoria_id', escs).whereIn('curso_id', curs)
    // tteas = await knex('posteos').select('posteos.id', 'posteos.nombre', 'ab_config.codigo')
    //   .join('cursos', 'posteos.curso_id', 'cursos.id')
    //   .join('ab_config', 'cursos.config_id', 'ab_config.id')
    //   .whereIn('posteos.categoria_id', escs).whereIn('posteos.curso_id', curs)
    //   .andWhere('tipo_ev', 'calificada')
    // console.log(tteas[0]);
    let temas = await knex.raw(`SELECT p.id, p.nombre, m.codigo
    from posteos as p
    inner join cursos as c on p.curso_id=c.id
    inner join ab_config as m on c.config_id=m.id
    where p.categoria_id in (${escs})
    and p.curso_id in (${curs})`)
    temas[0].forEach(obj => obj.nombre = obj.codigo + ' - ' + obj.nombre)
    return temas[0]
  },

  async loadSubworkspaceById(subworkspaceId) {
    const [rows] = await con.raw(`
      SELECT
       *
      FROM workspaces
      WHERE 
        parent_id is not null
        AND id = :subworkspaceId
        AND deleted_at is null 
    `, { subworkspaceId });
    return rows[0];
  },

  async loadCriterionValuesByParentId(criterionValuesParentId, criterionCode) {
    const temp = criterionValuesParentId.join(",");
    let query_string = `
    SELECT
      criterion_values.id, 
      criterion_values.value_text as name
    FROM
      criterion_values 
    WHERE
      EXISTS ( SELECT * FROM criteria WHERE criterion_values.criterion_id = criteria.id AND code = :criterionCode AND criteria.deleted_at IS NULL ) 
      AND EXISTS (
      SELECT
        * 
      FROM
        criterion_values AS laravel_reserved_0
        INNER JOIN criterion_value_relationship ON laravel_reserved_0.id = criterion_value_relationship.criterion_value_parent_id 
      WHERE
        criterion_values.id = criterion_value_relationship.criterion_value_id 
        AND id IN (`;

    criterionValuesParentId.forEach(cv => query_string += `${cv},`);
    query_string = query_string.slice(0, -1);

    query_string += `) 
        AND laravel_reserved_0.deleted_at IS NULL 
      ) 
      AND criterion_values.deleted_at IS NULL
    `;

    const [rows] = await con.raw(`${query_string}`, { criterionCode })
    return rows;
  }

}
