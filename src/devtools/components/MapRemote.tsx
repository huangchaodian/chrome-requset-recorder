import React, { useState, useEffect, useCallback } from 'react';
import { Button, Switch, Table, Modal, Input, Select, Space, message, Popconfirm, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined, CloseOutlined } from '@ant-design/icons';
import type { MapRemoteRule } from '../../shared/types';
import { sendMessage } from '../hooks/useMessageBridge';
import { MessageType } from '../../shared/messageTypes';
import { useRequestStore } from '../stores/requestStore';

/** 空规则模板 */
function createEmptyRule(): MapRemoteRule {
  return {
    id: crypto.randomUUID(),
    enabled: true,
    fromProtocol: '*',
    fromHost: '',
    fromPort: '',
    fromPath: '',
    fromQuery: '',
    toProtocol: 'http',
    toHost: '',
    toPort: '',
    toPath: '',
    toQuery: '',
    comment: '',
  };
}

/** 规则摘要展示 */
function ruleFromSummary(r: MapRemoteRule): string {
  const proto = r.fromProtocol === '*' ? '' : `${r.fromProtocol}://`;
  const port = r.fromPort ? `:${r.fromPort}` : '';
  const path = r.fromPath ? `/${r.fromPath}` : '';
  return `${proto}${r.fromHost}${port}${path}`;
}

function ruleToSummary(r: MapRemoteRule): string {
  const port = r.toPort ? `:${r.toPort}` : '';
  const path = r.toPath ? `/${r.toPath}` : '';
  return `${r.toProtocol}://${r.toHost}${port}${path}`;
}

/** 编辑弹窗 */
const EditRuleModal: React.FC<{
  open: boolean;
  rule: MapRemoteRule | null;
  onOk: (rule: MapRemoteRule) => void;
  onCancel: () => void;
}> = ({ open, rule, onOk, onCancel }) => {
  const [form, setForm] = useState<MapRemoteRule>(createEmptyRule());

  useEffect(() => {
    if (rule) setForm({ ...rule });
    else setForm(createEmptyRule());
  }, [rule, open]);

  const update = (field: keyof MapRemoteRule, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const labelStyle: React.CSSProperties = {
    width: 70, textAlign: 'right', flexShrink: 0, fontSize: 13, fontWeight: 500,
  };
  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
  };

  return (
    <Modal
      title="编辑映射规则"
      open={open}
      onOk={() => {
        if (!form.fromHost) {
          message.warning('请填写来源 Host');
          return;
        }
        if (!form.toHost) {
          message.warning('请填写目标 Host');
          return;
        }
        onOk(form);
      }}
      onCancel={onCancel}
      width={560}
      okText="确定"
      cancelText="取消"
    >
      {/* Map From */}
      <div style={{ background: '#fafafa', padding: '12px 16px', borderRadius: 6, marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#1677ff' }}>Map From</div>
        <div style={rowStyle}>
          <span style={labelStyle}>Protocol:</span>
          <Select
            size="small"
            value={form.fromProtocol}
            onChange={(v) => update('fromProtocol', v)}
            style={{ width: 100 }}
            options={[
              { value: 'http', label: 'http' },
              { value: 'https', label: 'https' },
              { value: '*', label: '*' },
            ]}
          />
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Host:</span>
          <Input
            size="small"
            value={form.fromHost}
            onChange={(e) => update('fromHost', e.target.value)}
            placeholder="例: www.baidu.com"
          />
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Port:</span>
          <Input
            size="small"
            value={form.fromPort}
            onChange={(e) => update('fromPort', e.target.value)}
            placeholder="留空=默认端口"
            style={{ width: 120 }}
          />
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Path:</span>
          <Input
            size="small"
            value={form.fromPath}
            onChange={(e) => update('fromPath', e.target.value)}
            placeholder="留空=匹配所有路径"
          />
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Query:</span>
          <Input
            size="small"
            value={form.fromQuery}
            onChange={(e) => update('fromQuery', e.target.value)}
            placeholder="留空=匹配所有"
          />
        </div>
      </div>

      {/* Map To */}
      <div style={{ background: '#f6ffed', padding: '12px 16px', borderRadius: 6, marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#52c41a' }}>Map To</div>
        <div style={rowStyle}>
          <span style={labelStyle}>Protocol:</span>
          <Select
            size="small"
            value={form.toProtocol}
            onChange={(v) => update('toProtocol', v)}
            style={{ width: 100 }}
            options={[
              { value: 'http', label: 'http' },
              { value: 'https', label: 'https' },
            ]}
          />
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Host:</span>
          <Input
            size="small"
            value={form.toHost}
            onChange={(e) => update('toHost', e.target.value)}
            placeholder="例: www.baidu.com"
          />
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Port:</span>
          <Input
            size="small"
            value={form.toPort}
            onChange={(e) => update('toPort', e.target.value)}
            placeholder="留空=默认端口"
            style={{ width: 120 }}
          />
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Path:</span>
          <Input
            size="small"
            value={form.toPath}
            onChange={(e) => update('toPath', e.target.value)}
            placeholder="留空=保持原路径"
          />
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>Query:</span>
          <Input
            size="small"
            value={form.toQuery}
            onChange={(e) => update('toQuery', e.target.value)}
            placeholder="留空=保持原查询"
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ ...labelStyle, width: 50 }}>备注:</span>
        <Input
          size="small"
          value={form.comment}
          onChange={(e) => update('comment', e.target.value)}
          placeholder="可选"
        />
      </div>
    </Modal>
  );
};

const MapRemote: React.FC = () => {
  const [rules, setRules] = useState<MapRemoteRule[]>([]);
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<MapRemoteRule | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const setView = useRequestStore((s) => s.setView);

  /** 加载数据 */
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [rulesData, enabledData] = await Promise.all([
        sendMessage<MapRemoteRule[]>(MessageType.GET_MAP_REMOTE_RULES),
        sendMessage<{ enabled: boolean }>(MessageType.GET_MAP_REMOTE_ENABLED),
      ]);
      setRules(rulesData);
      setGlobalEnabled(enabledData.enabled);
    } catch (err) {
      message.error('加载 Map Remote 规则失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /** 保存规则到后端 */
  const saveRules = async (newRules: MapRemoteRule[]) => {
    setRules(newRules);
    try {
      await sendMessage(MessageType.SAVE_MAP_REMOTE_RULES, newRules);
    } catch {
      message.error('保存规则失败');
    }
  };

  /** 全局开关 */
  const handleToggleGlobal = async (checked: boolean) => {
    setGlobalEnabled(checked);
    try {
      await sendMessage(MessageType.SET_MAP_REMOTE_ENABLED, { enabled: checked });
      message.success(checked ? 'Map Remote 已启用' : 'Map Remote 已禁用');
    } catch {
      message.error('切换失败');
    }
  };

  /** 单条规则启用/禁用 */
  const handleToggleRule = (id: string, checked: boolean) => {
    const updated = rules.map((r) => r.id === id ? { ...r, enabled: checked } : r);
    saveRules(updated);
  };

  /** 添加规则 */
  const handleAdd = () => {
    setEditingRule(null);
    setModalOpen(true);
  };

  /** 编辑规则 */
  const handleEdit = (rule: MapRemoteRule) => {
    setEditingRule(rule);
    setModalOpen(true);
  };

  /** 复制规则 */
  const handleDuplicate = (rule: MapRemoteRule) => {
    const dup = { ...rule, id: crypto.randomUUID(), comment: `${rule.comment} (副本)` };
    saveRules([...rules, dup]);
  };

  /** 删除规则 */
  const handleDelete = (id: string) => {
    saveRules(rules.filter((r) => r.id !== id));
  };

  /** 弹窗确认 */
  const handleModalOk = (rule: MapRemoteRule) => {
    if (editingRule) {
      // 编辑模式
      const updated = rules.map((r) => r.id === rule.id ? rule : r);
      saveRules(updated);
    } else {
      // 新增模式
      saveRules([...rules, rule]);
    }
    setModalOpen(false);
    message.success(editingRule ? '规则已更新' : '规则已添加');
  };

  const columns = [
    {
      title: '',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 50,
      render: (_: boolean, record: MapRemoteRule) => (
        <Switch size="small" checked={record.enabled} onChange={(c) => handleToggleRule(record.id, c)} />
      ),
    },
    {
      title: 'From',
      key: 'from',
      ellipsis: true,
      render: (_: unknown, record: MapRemoteRule) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{ruleFromSummary(record)}</span>
      ),
    },
    {
      title: 'To',
      key: 'to',
      ellipsis: true,
      render: (_: unknown, record: MapRemoteRule) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#52c41a' }}>{ruleToSummary(record)}</span>
      ),
    },
    {
      title: '备注',
      dataIndex: 'comment',
      key: 'comment',
      width: 120,
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: MapRemoteRule) => (
        <Space size={4}>
          <Tooltip title="编辑"><Button size="small" type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} /></Tooltip>
          <Tooltip title="复制"><Button size="small" type="text" icon={<CopyOutlined />} onClick={() => handleDuplicate(record)} /></Tooltip>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)} okText="删除" cancelText="取消">
            <Tooltip title="删除"><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 头部 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: '1px solid #f0f0f0', background: '#fafafa', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Map Remote</span>
          <Switch
            checked={globalEnabled}
            onChange={handleToggleGlobal}
            checkedChildren="已启用"
            unCheckedChildren="已禁用"
          />
        </div>
        <Space size={8}>
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAdd}>
            添加规则
          </Button>
          <Tooltip title="关闭">
            <Button size="small" type="text" icon={<CloseOutlined />} onClick={() => setView('detail')} />
          </Tooltip>
        </Space>
      </div>

      {/* 规则列表 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 8px' }}>
        <Table
          dataSource={rules}
          columns={columns}
          rowKey="id"
          size="small"
          loading={loading}
          pagination={false}
          locale={{ emptyText: '暂无映射规则，点击"添加规则"开始配置' }}
          onRow={(record) => ({
            onDoubleClick: () => handleEdit(record),
            style: { opacity: record.enabled && globalEnabled ? 1 : 0.5 },
          })}
        />
      </div>

      {/* 编辑弹窗 */}
      <EditRuleModal
        open={modalOpen}
        rule={editingRule}
        onOk={handleModalOk}
        onCancel={() => setModalOpen(false)}
      />
    </div>
  );
};

export default MapRemote;