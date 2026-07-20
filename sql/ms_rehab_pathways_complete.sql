-- =====================================================
-- 肌骨康复临床路径数据库 - 完整建库建表脚本
-- 数据库版本: MySQL 8.0+
-- 字符集: utf8mb4
-- 存储引擎: InnoDB
-- =====================================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS ms_rehab_pathways
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE ms_rehab_pathways;

-- =====================================================
-- 1. 路径主表（path_main）
-- 存储所有临床康复路径的元数据
-- =====================================================
CREATE TABLE IF NOT EXISTS path_main (
    path_id         VARCHAR(20)     NOT NULL COMMENT '路径ID，主键，如CP-MS-001',
    path_name       VARCHAR(200)    NOT NULL COMMENT '路径名称',
    icd_code        VARCHAR(20)     NOT NULL COMMENT 'ICD-10疾病编码',
    path_type       VARCHAR(20)     NOT NULL COMMENT '路径类型：保守/术后/围手术期',
    body_region     VARCHAR(20)     NOT NULL COMMENT '身体部位：脊柱/肩/肘/腕手/髋/膝/踝足/全身',
    total_stages    INT             NOT NULL DEFAULT 3 COMMENT '总阶段数',
    guideline_source TEXT           NULL COMMENT '指南依据来源',
    version         VARCHAR(20)     NOT NULL COMMENT '版本号，如V2024.1',
    is_active       TINYINT(1)      NOT NULL DEFAULT 1 COMMENT '是否启用：1启用，0停用',
    create_time     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (path_id),
    INDEX idx_body_region (body_region),
    INDEX idx_path_type (path_type),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='路径主表——存储所有肌骨康复临床路径的元数据';

-- =====================================================
-- 2. 阶段定义表（stage_definition）
-- 每个路径按时间轴划分的治疗阶段
-- =====================================================
CREATE TABLE IF NOT EXISTS stage_definition (
    stage_id        VARCHAR(30)     NOT NULL COMMENT '阶段ID，主键',
    path_id         VARCHAR(20)     NOT NULL COMMENT '外键→路径主表',
    stage_no        INT             NOT NULL COMMENT '阶段序号，从1开始',
    stage_name      VARCHAR(100)    NOT NULL COMMENT '阶段名称',
    time_window     VARCHAR(100)    NOT NULL COMMENT '时间窗描述，如术后0-2周',
    stage_goal      TEXT            NULL COMMENT '阶段核心目标',
    create_time     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (stage_id),
    INDEX idx_path_id (path_id),
    UNIQUE KEY uk_path_stage (path_id, stage_no),
    CONSTRAINT fk_stage_path FOREIGN KEY (path_id) REFERENCES path_main(path_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='阶段定义表——每个路径按时间轴划分的治疗阶段';

-- =====================================================
-- 3. 干预活动表（intervention_activity）
-- 每个阶段内的具体诊疗/康复活动
-- =====================================================
CREATE TABLE IF NOT EXISTS intervention_activity (
    activity_id     VARCHAR(30)     NOT NULL COMMENT '活动ID，主键',
    stage_id        VARCHAR(30)     NOT NULL COMMENT '外键→阶段定义表',
    activity_name   VARCHAR(200)    NOT NULL COMMENT '活动名称',
    activity_type   VARCHAR(30)     NOT NULL COMMENT '活动类型：检查/治疗/评定/护理/教育',
    performer_role  VARCHAR(50)     NOT NULL COMMENT '执行角色：康复医师/治疗师/护士/患者自主',
    frequency       VARCHAR(100)    NULL COMMENT '执行频率，如每日2次',
    duration_min    INT             NULL COMMENT '单次时长（分钟）',
    is_mandatory    TINYINT(1)      NOT NULL DEFAULT 1 COMMENT '是否必选项：1必选，0可选',
    pinyin_code     VARCHAR(20)     NULL COMMENT '拼音助记码，用于快速检索',
    create_time     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (activity_id),
    INDEX idx_stage_id (stage_id),
    INDEX idx_activity_type (activity_type),
    INDEX idx_performer_role (performer_role),
    CONSTRAINT fk_activity_stage FOREIGN KEY (stage_id) REFERENCES stage_definition(stage_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='干预活动表——每个阶段内的具体诊疗/康复活动';

-- =====================================================
-- 4. 评定节点表（evaluation_node）
-- 路径中必须完成的评估节点
-- =====================================================
CREATE TABLE IF NOT EXISTS evaluation_node (
    eval_id         VARCHAR(30)     NOT NULL COMMENT '评定ID，主键',
    path_id         VARCHAR(20)     NOT NULL COMMENT '外键→路径主表',
    eval_name       VARCHAR(200)    NOT NULL COMMENT '评定名称',
    eval_tool       VARCHAR(200)    NULL COMMENT '评定工具/量表名称',
    eval_timepoint  VARCHAR(50)     NOT NULL COMMENT '评定时机：入院/阶段转换/出院/随访',
    eval_type       VARCHAR(20)     NOT NULL COMMENT '评定类型：功能/疼痛/心理/综合/影像',
    performer_role  VARCHAR(50)     NULL COMMENT '执行角色',
    is_mandatory    TINYINT(1)      NOT NULL DEFAULT 1 COMMENT '是否必评：1必评，0可选',
    create_time     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (eval_id),
    INDEX idx_path_id (path_id),
    INDEX idx_eval_timepoint (eval_timepoint),
    CONSTRAINT fk_eval_path FOREIGN KEY (path_id) REFERENCES path_main(path_id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='评定节点表——路径中必须完成的评估节点';

-- =====================================================
-- 5. 变异记录表（variation_record）
-- 患者偏离路径的变异事件记录
-- =====================================================
CREATE TABLE IF NOT EXISTS variation_record (
    variation_id        VARCHAR(30)     NOT NULL COMMENT '变异ID，主键',
    instance_id         VARCHAR(30)     NOT NULL COMMENT '关联路径实例ID',
    variation_type      VARCHAR(20)     NOT NULL COMMENT '变异类型：正性/负性',
    variation_category  VARCHAR(30)     NOT NULL COMMENT '变异分类：患者因素/医疗因素/系统因素',
    variation_reason    TEXT            NULL COMMENT '变异原因描述',
    management_action   TEXT            NULL COMMENT '处理措施',
    is_path_exit        TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '是否退出路径：1退出，0未退出',
    recording_time      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
    recorder_id         VARCHAR(20)     NULL COMMENT '记录人ID',
    PRIMARY KEY (variation_id),
    INDEX idx_instance_id (instance_id),
    INDEX idx_variation_type (variation_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='变异记录表——患者偏离路径的变异事件记录';

-- =====================================================
-- 6. 路径实例表（path_instance）
-- 患者实际执行路径的记录
-- =====================================================
CREATE TABLE IF NOT EXISTS path_instance (
    instance_id             VARCHAR(30)     NOT NULL COMMENT '实例ID，主键',
    patient_id              VARCHAR(20)     NOT NULL COMMENT '患者ID',
    path_id                 VARCHAR(20)     NOT NULL COMMENT '外键→路径主表',
    path_version            VARCHAR(20)     NOT NULL COMMENT '路径版本号，记录当时使用的版本',
    entry_date              DATETIME        NOT NULL COMMENT '入径时间',
    entry_stage_no          INT             NOT NULL DEFAULT 1 COMMENT '入径阶段序号',
    current_stage_no        INT             NOT NULL DEFAULT 1 COMMENT '当前阶段序号',
    phase_transition_dates  JSON            NULL COMMENT '各阶段转换日期，JSON格式存储',
    exit_date               DATETIME        NULL COMMENT '出径时间',
    exit_reason             VARCHAR(50)     NULL COMMENT '出径原因：完成/变异退出/死亡/转科',
    total_variations        INT             NOT NULL DEFAULT 0 COMMENT '累计变异次数',
    is_closed               TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '是否已关闭：1关闭，0进行中',
    create_time             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (instance_id),
    INDEX idx_patient_id (patient_id),
    INDEX idx_path_id (path_id),
    INDEX idx_is_closed (is_closed),
    CONSTRAINT fk_instance_path FOREIGN KEY (path_id) REFERENCES path_main(path_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='路径实例表——患者实际执行路径的记录';

-- =====================================================
-- 7. 路径执行记录表（execution_record）
-- 核心行为数据表，记录患者每天/每次的执行情况
-- =====================================================
CREATE TABLE IF NOT EXISTS execution_record (
    execution_id        BIGINT          NOT NULL AUTO_INCREMENT COMMENT '执行记录ID，主键自增',
    instance_id         VARCHAR(30)     NOT NULL COMMENT '外键→路径实例表',
    activity_id         VARCHAR(30)     NOT NULL COMMENT '外键→干预活动表',
    planned_date        DATE            NULL COMMENT '计划执行日期',
    actual_date         DATETIME        NULL COMMENT '实际执行时间',
    execution_status    VARCHAR(10)     NOT NULL DEFAULT 'pending' COMMENT '执行状态：completed/未完成/部分完成/cancelled/pending',
    performer_id        VARCHAR(20)     NULL COMMENT '执行人ID',
    patient_response    TEXT            NULL COMMENT '患者反应：疼痛评分/耐受性/不适描述',
    clinical_notes      TEXT            NULL COMMENT '治疗师备注',
    pain_before         TINYINT         NULL COMMENT '治疗前疼痛评分(0-10)',
    pain_after          TINYINT         NULL COMMENT '治疗后疼痛评分(0-10)',
    is_variation        TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '是否触发变异',
    variation_id        VARCHAR(30)     NULL COMMENT '关联变异记录ID',
    hospital_day        INT             NULL COMMENT '住院天数（方便统计）',
    create_time         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (execution_id),
    INDEX idx_instance_id (instance_id),
    INDEX idx_activity_id (activity_id),
    INDEX idx_execution_status (execution_status),
    INDEX idx_planned_date (planned_date),
    INDEX idx_actual_date (actual_date),
    CONSTRAINT fk_exec_instance FOREIGN KEY (instance_id) REFERENCES path_instance(instance_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_exec_activity FOREIGN KEY (activity_id) REFERENCES intervention_activity(activity_id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='路径执行记录表——核心行为数据表，记录患者每天/每次的执行情况';
-- =====================================================
-- 路径主表数据 - 共76条路径
-- =====================================================
INSERT INTO path_main (path_id, path_name, icd_code, path_type, body_region, total_stages, guideline_source, version, is_active) VALUES

-- 原有3条路径
('CP-MS-001', '髋关节置换术后康复路径', 'Z96.6-Z96.7', '术后', '髋', 4, '2023版国家卫健委THA加速康复临床路径', 'V2023.1', 1),
('CP-MS-002', '膝关节置换术后康复路径', 'Z96.6', '术后', '膝', 4, '2024版TKA术后功能加速康复专家共识', 'V2024.1', 1),
('CP-MS-003', '肩袖损伤术后康复路径', 'M75.1', '术后', '肩', 4, '2024-2025 AAOS指南+ASSET共识', 'V2025.1', 1),

-- 肩部路径 (CP-MS-004 ~ CP-MS-010)
('CP-MS-004', '肱二头肌肌腱损伤和断裂康复路径', 'S46.1-S46.2', '保守/术后', '肩', 4, '国家卫健委临床路径(2017版)', 'V2017.1', 1),
('CP-MS-005', '冻结肩(肩周炎)分期康复路径', 'M75.0', '保守', '肩', 3, '2024 AAOS共识+2025中国肩关节康复专家共识', 'V2025.1', 1),
('CP-MS-006', '肩峰下撞击综合征保守康复路径', 'M75.4', '保守', '肩', 3, '2024 AAOS指南', 'V2024.1', 1),
('CP-MS-007', '肩关节不稳(脱位)术后康复路径', 'S43.0', '术后', '肩', 4, '2024 ASSET共识', 'V2024.1', 1),
('CP-MS-008', '锁骨骨折术后康复路径', 'S42.0', '术后', '肩', 3, '骨科术后康复通用模式', 'V2025.1', 1),
('CP-MS-009', '肱骨近端骨折术后康复路径', 'S42.2', '术后', '肩', 4, '2024 AAOS骨折管理指南', 'V2024.1', 1),
('CP-MS-010', '肩锁关节脱位术后康复路径', 'S43.1', '术后', '肩', 4, '2024 AAOS指南', 'V2024.1', 1),

-- 肘部路径 (CP-MS-011 ~ CP-MS-016)
('CP-MS-011', '肘关节骨折术后康复路径', 'S52', '术后', '肘', 4, '2024 AAOS骨折管理指南', 'V2024.1', 1),
('CP-MS-012', '肘关节僵硬康复路径', 'M24.6', '保守/术后', '肘', 3, '2024 ASSH指南', 'V2024.1', 1),
('CP-MS-013', '肱骨外上髁炎(网球肘)保守康复路径', 'M77.1', '保守', '肘', 3, '2024 AAOS指南', 'V2024.1', 1),
('CP-MS-014', '肘管综合征术后康复路径', 'G56.2', '术后', '肘', 2, '2024 ASSH指南', 'V2024.1', 1),
('CP-MS-015', '肱骨髁上骨折术后康复路径(儿童)', 'S42.4', '术后', '肘', 3, '2025 AAOS儿童骨折指南', 'V2025.1', 1),
('CP-MS-016', '孟氏骨折术后康复路径', 'S52.0', '术后', '肘', 4, '2024 AAOS骨折管理指南', 'V2024.1', 1),

-- 腕手部路径 (CP-MS-017 ~ CP-MS-027)
('CP-MS-017', '腕管综合征术后康复路径', 'G56.0', '术后', '腕手', 2, '2024 ASSH指南', 'V2024.1', 1),
('CP-MS-018', '手部肌腱损伤术后康复路径', 'S66', '术后', '腕手', 4, '2024 ASSH指南', 'V2024.1', 1),
('CP-MS-019', '腕关节骨折(桡骨远端)术后康复路径', 'S52.5-S52.6', '术后', '腕手', 4, '2024 AAOS骨折管理指南', 'V2024.1', 1),
('CP-MS-020', '拇指基底部关节炎(CMC)术后康复路径', 'M18', '术后', '腕手', 3, '2025 ASSH共识', 'V2025.1', 1),
('CP-MS-021', '腕管综合征保守康复路径', 'G56.0', '保守', '腕手', 2, '2024 ASSH指南', 'V2024.1', 1),
('CP-MS-022', 'De Quervain腱鞘炎保守康复路径', 'M65.4', '保守', '腕手', 2, '2024 ASSH指南', 'V2024.1', 1),
('CP-MS-023', '扳机指(狭窄性腱鞘炎)术后康复路径', 'M65.3', '术后', '腕手', 2, '2024 ASSH指南', 'V2024.1', 1),
('CP-MS-024', '盖氏骨折术后康复路径', 'S52.2', '术后', '腕手', 4, '2024 AAOS骨折管理指南', 'V2024.1', 1),
('CP-MS-025', '手外伤康复临床路径(综合版)', 'S61/S62/S66/S67', '术后', '腕手', 3, '国家卫健委手外伤康复临床路径(2016年版)', 'V2016.1', 1),
('CP-MS-026', '手部骨折内固定术后康复路径', 'S62', '术后', '腕手', 3, '2024 AAOS骨折管理指南', 'V2024.1', 1),
('CP-MS-027', '断指再植术后康复路径', 'S68.0-S68.1', '术后', '腕手', 4, '2025中国显微外科康复共识', 'V2025.1', 1),

-- 脊柱路径 (CP-MS-028 ~ CP-MS-038)
('CP-MS-028', '腰椎间盘突出症保守康复路径', 'M51.1', '保守', '脊柱', 3, '2024 NASS指南', 'V2024.1', 1),
('CP-MS-029', '腰椎术后康复路径(融合/减压)', 'M51.1/Z98.1', '术后', '脊柱', 4, '2025 NASS指南', 'V2025.1', 1),
('CP-MS-030', '颈椎病(神经根型)保守康复路径', 'M47.2', '保守', '脊柱', 3, '2024 NASS指南+2025中国颈椎病康复共识', 'V2025.1', 1),
('CP-MS-031', '特发性脊柱侧凸保守康复路径', 'M41.1', '保守', '脊柱', 3, 'SOSORT 2024指南', 'V2024.1', 1),
('CP-MS-032', '脊柱压缩性骨折保守康复路径', 'S32.0', '保守', '脊柱', 3, '2024 NASS指南', 'V2024.1', 1),
('CP-MS-033', '骨质疏松性椎体压缩骨折PVP/PKP术后路径', 'M80.0', '术后', '脊柱', 3, '2025中国骨质疏松性骨折康复指南', 'V2025.1', 1),
('CP-MS-034', '慢性腰痛(非特异性)保守康复路径', 'M54.5', '保守', '脊柱', 3, '2025 Lancet腰痛系列', 'V2025.1', 1),
('CP-MS-035', '强直性脊柱炎康复路径', 'M45', '保守', '脊柱', 3, '2024 ASAS-EULAR指南', 'V2024.1', 1),
('CP-MS-036', '上交叉综合征(圆肩驼背)体态矫正康复路径', 'M40.0/M41.0', '保守', '脊柱', 3, '2025中国体态康复专家共识', 'V2025.1', 1),
('CP-MS-037', '下交叉综合征(骨盆前倾)体态矫正康复路径', 'M40.3/M40.4', '保守', '脊柱', 3, '2025中国姿势康复指南', 'V2025.1', 1),
('CP-MS-038', '颈源性头痛康复路径', 'G44.8/M53.0', '保守', '脊柱', 3, '2024国际头痛学会指南+颈椎康复共识', 'V2024.1', 1),

-- 膝部路径 (CP-MS-039 ~ CP-MS-048)
('CP-MS-039', '膝骨关节炎(非手术)阶梯化康复路径', 'M17', '保守', '膝', 3, '2024 OARSI指南+2025中国骨关节炎诊疗指南', 'V2025.1', 1),
('CP-MS-040', '前交叉韧带(ACL)重建术后康复路径', 'S83.5', '术后', '膝', 5, '2025 ACL重建康复国际共识', 'V2025.1', 1),
('CP-MS-041', '半月板修复术后康复路径', 'S83.2', '术后', '膝', 4, '2024 AAOS指南', 'V2024.1', 1),
('CP-MS-042', '髌骨骨折术后康复路径', 'S82.0', '术后', '膝', 4, '骨科术后康复通用模式', 'V2025.1', 1),
('CP-MS-043', '髌股关节综合征保守康复路径', 'M22.4', '保守', '膝', 3, '2024 APTA临床实践指南', 'V2024.1', 1),
('CP-MS-044', '膝关节周围骨折(胫骨平台/股骨髁)术后路径', 'S82.1/S72.4', '术后', '膝', 4, '2024 AAOS骨折管理指南', 'V2024.1', 1),
('CP-MS-045', '胫骨应力综合征(外胫夹)康复路径', 'M76.8/S82.2', '保守', '膝', 3, '2024 ACSM运动医学指南', 'V2024.1', 1),
('CP-MS-046', '髌腱炎(跳跃膝)康复路径', 'M76.5', '保守', '膝', 3, '2024 APTA临床实践指南', 'V2024.1', 1),
('CP-MS-047', '腘窝囊肿术后康复路径', 'M71.2', '术后', '膝', 3, '2025 AAOS指南', 'V2025.1', 1),
('CP-MS-048', '膝关节韧带损伤(MCL)保守康复路径', 'S83.4', '保守', '膝', 3, '2024 AAOS指南', 'V2024.1', 1),

-- 髋部路径 (CP-MS-049 ~ CP-MS-056)
('CP-MS-049', '股骨颈骨折术后康复路径', 'S72.0', '术后', '髋', 4, '2024 AAOS骨折管理指南', 'V2024.1', 1),
('CP-MS-050', '髋关节撞击综合征(FAI)术后康复路径', 'M76.8', '术后', '髋', 4, '2025 ISHA共识', 'V2025.1', 1),
('CP-MS-051', '髋关节撞击综合征(FAI)保守康复路径', 'M76.8', '保守', '髋', 3, '2025 ISHA共识', 'V2025.1', 1),
('CP-MS-052', '股骨头坏死保守康复路径', 'M87.0', '保守', '髋', 3, '2024 AAOS指南', 'V2024.1', 1),
('CP-MS-053', '骨盆骨折术后康复路径', 'S32', '术后', '髋', 4, '2025 OTA指南', 'V2025.1', 1),
('CP-MS-054', '梨状肌综合征康复路径', 'G57.0/M76.0', '保守', '髋', 2, '2024 AAOS指南', 'V2024.1', 1),
('CP-MS-055', '弹响髋康复路径', 'M76.8', '保守', '髋', 2, '2025 ISHA共识', 'V2025.1', 1),
('CP-MS-056', '髋关节发育不良(DDH)术后康复路径', 'Q65', '术后', '髋', 4, '2025 POSNA指南', 'V2025.1', 1),

-- 踝足部路径 (CP-MS-057 ~ CP-MS-066)
('CP-MS-057', '踝关节扭伤保守康复路径', 'S93.4', '保守', '踝足', 3, '2024 ESSKA-AFAS共识', 'V2024.1', 1),
('CP-MS-058', '慢性踝关节不稳康复路径', 'M24.4', '保守', '踝足', 3, '2024 ESSKA-AFAS共识', 'V2024.1', 1),
('CP-MS-059', '跟腱断裂保守治疗康复路径', 'S86.0', '保守', '踝足', 4, '2024 AAOS指南', 'V2024.1', 1),
('CP-MS-060', '跟腱断裂术后康复路径', 'S86.0', '术后', '踝足', 4, '2024 AAOS指南', 'V2024.1', 1),
('CP-MS-061', '踝关节骨折术后康复路径(细化版)', 'S82.8', '术后', '踝足', 4, '2024 AAOS骨折管理指南', 'V2024.1', 1),
('CP-MS-062', '足底筋膜炎保守康复路径', 'M72.2', '保守', '踝足', 3, '2024 APTA临床实践指南', 'V2024.1', 1),
('CP-MS-063', '拇外翻(踇囊炎)术后康复路径', 'M20.1', '术后', '踝足', 3, '2024 ACFAS指南', 'V2024.1', 1),
('CP-MS-064', '踝关节韧带修复术后康复路径', 'S93.4', '术后', '踝足', 4, '2024 ESSKA-AFAS共识', 'V2024.1', 1),
('CP-MS-065', '踝关节骨关节炎阶梯化康复路径', 'M19.0', '保守', '踝足', 3, '2024 OARSI指南', 'V2024.1', 1),
('CP-MS-066', '踝部韧带损伤康复临床路径', 'S93.4/S93.5/S93.6', '保守/术后', '踝足', 3, '国家卫健委踝部韧带损伤康复临床路径(2018版)', 'V2018.1', 1),

-- 全身性及其他路径 (CP-MS-067 ~ CP-MS-076)
('CP-MS-067', '多发性肌炎/皮肌炎康复路径', 'M33', '保守', '全身', 3, '2024 EULAR指南', 'V2024.1', 1),
('CP-MS-068', '纤维肌痛综合康复路径', 'M79.7', '保守', '全身', 3, '2025 EULAR指南', 'V2025.1', 1),
('CP-MS-069', '肌少症综合康复路径', 'M62.8', '保守', '全身', 3, '2026亚洲肌少症共识', 'V2026.1', 1),
('CP-MS-070', '血友病性关节病康复路径', 'M36.2', '保守', '全身', 3, '2024 WFH指南', 'V2024.1', 1),
('CP-MS-071', '运动疲劳与过度训练康复路径', 'Z73.0', '保守', '全身', 3, '2026 ACSM运动医学指南', 'V2026.1', 1),
('CP-MS-072', '胸廓出口综合征(TOS)保守康复路径', 'G54.0', '保守', '肩', 3, '2024国际TOS共识', 'V2024.1', 1),
('CP-MS-073', '颞下颌关节紊乱(TMD)康复路径', 'K07.6/K07.7', '保守', '头颈', 3, '2024 AAOP指南', 'V2024.1', 1),
('CP-MS-074', '截肢后康复路径', 'S48/S58/S68/S78/S88/S98', '术后', '全身', 3, '国家卫计委截肢后康复临床路径(2017版)', 'V2017.1', 1),
('CP-MS-075', '肌肉拉伤/软组织损伤保守康复路径', 'S46/S56/S66/S76/S86/S96', '保守', '全身', 3, '2024 ACSM运动医学指南', 'V2024.1', 1),
('CP-MS-076', '踝关节不稳术后康复路径(韧带修复术后)', 'M24.4', '术后', '踝足', 4, '2024 ESSKA-AFAS共识', 'V2024.1', 1);
-- =====================================================
-- 阶段定义表数据 - 核心路径阶段定义
-- =====================================================
INSERT INTO stage_definition (stage_id, path_id, stage_no, stage_name, time_window, stage_goal) VALUES

-- CP-MS-001 髋关节置换术后
('ST-001-01', 'CP-MS-001', 1, '急性期(住院期)', '术后0-3天', '控制疼痛肿胀，预防并发症（DVT/感染），基础肌力激活'),
('ST-001-02', 'CP-MS-001', 2, '早期功能恢复期', '术后4-14天', '恢复关节活动度，逐步负重训练，ADL训练'),
('ST-001-03', 'CP-MS-001', 3, '中期强化期', '术后2-6周', '强化肌力，恢复正常步态，本体感觉训练'),
('ST-001-04', 'CP-MS-001', 4, '长期维持期', '术后6周后', '全面功能维持，重返日常生活，预防远期并发症'),

-- CP-MS-002 膝关节置换术后
('ST-002-01', 'CP-MS-002', 1, '急性期(住院期)', '术后0-3天', '控制疼痛肿胀，达到被动伸膝0°，股四头肌激活'),
('ST-002-02', 'CP-MS-002', 2, '早期功能恢复期', '术后4-14天', '恢复屈膝90°以上，逐步负重，直腿抬高训练'),
('ST-002-03', 'CP-MS-002', 3, '中期强化期', '术后2-8周', '屈膝>120°，肌力恢复至健侧60%，上下楼梯训练'),
('ST-002-04', 'CP-MS-002', 4, '长期维持期', '术后8周后', '肌力恢复至健侧80%以上，重返日常生活'),

-- CP-MS-003 肩袖损伤术后
('ST-003-01', 'CP-MS-003', 1, '严格保护期', '术后0-6周', '保护修复结构，控制疼痛肿胀，预防并发症'),
('ST-003-02', 'CP-MS-003', 2, '主动活动恢复期', '术后6-12周', '恢复主动关节活动度，激活肩袖肌群'),
('ST-003-03', 'CP-MS-003', 3, '力量强化期', '术后3-6个月', '强化肩袖及肩胛周围肌群力量'),
('ST-003-04', 'CP-MS-003', 4, '重返运动期', '术后6个月后', '全面恢复运动能力，预防再损伤'),

-- CP-MS-004 肱二头肌肌腱损伤
('ST-004-01', 'CP-MS-004', 1, '急性保护期', '住院第1-3天', '控制炎症疼痛，完成初期康复评定，明确诊断'),
('ST-004-02', 'CP-MS-004', 2, '早期康复期', '住院第4-15天', '物理因子治疗减轻疼痛肿胀，逐步恢复关节活动度'),
('ST-004-03', 'CP-MS-004', 3, '功能恢复期', '住院第16-20天', '指导出院后康复训练，渐进抗阻训练及ADL训练'),
('ST-004-04', 'CP-MS-004', 4, '巩固维持期', '出院后-12周', '肌力强化训练，重返工作与运动'),

-- CP-MS-005 冻结肩
('ST-005-01', 'CP-MS-005', 1, '炎症期(冻结进行期)', '0-3个月', '控制疼痛和炎症反应，维持现有关节活动度'),
('ST-005-02', 'CP-MS-005', 2, '冻结期(粘连期)', '3-9个月', '逐步恢复关节活动度，关节松动术分级干预'),
('ST-005-03', 'CP-MS-005', 3, '解冻期(恢复期)', '9-15个月', '全面恢复主动活动范围，强化肩袖及肩胛周围肌群力量'),

-- CP-MS-028 腰椎间盘突出症保守
('ST-028-01', 'CP-MS-028', 1, '急性期', '0-2周', '缓解剧烈疼痛，避免加重动作（弯腰/扭转），麦肯基伸展原则'),
('ST-028-02', 'CP-MS-028', 2, '亚急性期', '2-6周', '逐步恢复腰椎活动度，核心稳定训练（腹横肌/多裂肌再激活）'),
('ST-028-03', 'CP-MS-028', 3, '慢性期/功能期', '6周后', '全面核心强化、功能性训练、工作姿势教育、预防复发'),

-- CP-MS-039 膝骨关节炎阶梯化
('ST-039-01', 'CP-MS-039', 1, '基础治疗期', '持续进行', '健康教育、体重管理(BMI<24)、低冲击有氧运动'),
('ST-039-02', 'CP-MS-039', 2, '核心强化期', '4-12周', '股四头肌-腘绳肌-臀肌强化训练，本体感觉训练'),
('ST-039-03', 'CP-MS-039', 3, '维持与进阶期', '12周后', '高强度肌力维持，运动模式优化，必要时转诊注射/手术评估'),

-- CP-MS-040 ACL重建术后
('ST-040-01', 'CP-MS-040', 1, '术后保护期', '术后0-2周', '消肿止痛、屈膝90°、预防伸膝滞后'),
('ST-040-02', 'CP-MS-040', 2, '早期负重期', '术后2-6周', '逐步负重、闭链肌力、本体感觉重建'),
('ST-040-03', 'CP-MS-040', 3, '肌力强化期', '术后6周-3月', '肌力与功能恢复、运动控制'),
('ST-040-04', 'CP-MS-040', 4, '功能恢复期', '术后3-6月', '开链训练+离心强化、跑步渐进训练'),
('ST-040-05', 'CP-MS-040', 5, '重返运动期', '术后6-9月', '运动专项训练、生物力学重返筛选');
