import React, { useCallback, useState } from 'react';
import { Input, Select, Button, Tag, Space, Modal, Switch, List, Empty, message, Tooltip } from 'antd';
import {
  SearchOutlined,
  DeleteOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  StarOutlined,
  ApiOutlined,
  GlobalOutlined,
  PlusOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useRequestStore } from '../stores/requestStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useMessageBridge, sendMessage } from '../hooks/useMessageBridge';
import { HTTP_METHODS, STATUS_RANGES } from '../../shared/constants';
import { MessageType } from '../../shared/messageTypes';
import type { Settings } from '../../shared/types';

const FilterBar: React.FC = () => {
  const filters = useRequestStore((s) => s.filters);
  const setFilters = useRequestStore((s) => s.setFilters);
  const clearAll = useRequestStore((s) => s.clearAll);
  const setView = useRequestStore((s) => s.setView);
  const isRecording = useSettingsStore((s) => s.isRecordingEnabled);
  const domainFilterEnabled = useSettingsStore((s) => s.domainFilterEnabled);
  const recordDomains = useSettingsStore((s) => s.recordDomains);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const { clearRequests, toggleRecording } = useMessageBridge();

  // 域名设置弹窗状态
  const [domainModalOpen, setDomainModalOpen] = useState(false);
  const [draftEnabled, setDraftEnabled] = useState(false);
  const [draftDomains, setDraftDomains] = useState<string[]>([]);
  const [domainInput, setDomainInput] = useState('');

  const handleSearch = useCallback(
    (value: string) => {
      setFilters({ keyword: value });
    },
    [setFilters]
  );

  const handleMethodChange = useCallback(
    (values: string[]) => {
      setFilters({ methods: values });
    },
    [setFilters]
  );

  const handleStatusChange = useCallback(
    (values: string[]) => {
      setFilters({ statusRange: values });
    },
    [setFilters]
  );

  const handleClear = useCallback(async () => {
    await clearRequests();
    clearAll();
  }, [clearRequests, clearAll]);

  const handleToggleRecording = useCallback(async () => {
    const newStatus = !isRecording;
    await toggleRecording(newStatus);
    setSettings({ isRecordingEnabled: newStatus });
  }, [isRecording, toggleRecording, setSettings]);

  // 打开弹窗时同步当前设置到草稿
  const openDomainModal = useCallback(() => {
    setDraftEnabled(domainFilterEnabled);
    setDraftDomains([...recordDomains]);
    setDomainInput('');
    setDomainModalOpen(true);
  }, [domainFilterEnabled, recordDomains]);

  // 解析输入：支持完整 URL 或主机名，自动提取 hostname
  const normalizeDomain = (raw: string): string | null => {
    const v = raw.trim().toLowerCase();
    if (!v) return null;
    // 尝试当作 URL 解析
    try {
      if (v.includes('://')) {
        return new URL(v).hostname || null;
      }
    } catch {
      /* ignore */
    }
    // 简单字符校验：允许字母数字、点、连字符、星号、冒号端口
    if (!/^[a-z0-9.\-*]+(:\d+)?$/.test(v)) return null;
    return v.replace(/:\d+$/, '');
  };

  const handleAddDomain = useCallback(() => {
    const normalized = normalizeDomain(domainInput);
    if (!normalized) {
      message.warning('请输入合法的域名或 URL');
      return;
    }
    if (draftDomains.includes(normalized)) {
      message.info('该域名已存在');
      return;
    }
    setDraftDomains([...draftDomains, normalized]);
    setDomainInput('');
  }, [domainInput, draftDomains]);

  const handleRemoveDomain = useCallback(
    (domain: string) => {
      setDraftDomains(draftDomains.filter((d) => d !== domain));
    },
    [draftDomains]
  );

  const handleSaveDomainSettings = useCallback(async () => {
    try {
      const updated = await sendMessage<Settings>(MessageType.UPDATE_SETTINGS, {
        domainFilterEnabled: draftEnabled,
        recordDomains: draftDomains,
      });
      setSettings(updated);
      message.success('录制域名设置已保存');
      setDomainModalOpen(false);
    } catch (err) {
      message.error('保存失败：' + (err instanceof Error ? err.message : String(err)));
    }
  }, [draftEnabled, draftDomains, setSettings]);

  // 是否处于域名过滤激活状态（用于按钮高亮）
  const isDomainFilterActive = domainFilterEnabled && recordDomains.length > 0;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 12px',
      borderBottom: '1px solid #e8e8e8',
      background: '#fafafa',
      flexWrap: 'wrap',
    }}>
      {/* 录制状态指示灯 */}
      <Button
        type="text"
        size="small"
        icon={isRecording ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
        onClick={handleToggleRecording}
        style={{ color: isRecording ? '#f5222d' : '#8c8c8c' }}
      >
        <Tag
          color={isRecording ? 'red' : 'default'}
          style={{ marginLeft: 4, marginRight: 0 }}
        >
          {isRecording ? 'REC' : 'PAUSED'}
        </Tag>
      </Button>

      {/* 搜索框 */}
      <Input
        placeholder="搜索 URL/请求体/响应体..."
        prefix={<SearchOutlined />}
        size="small"
        allowClear
        value={filters.keyword}
        onChange={(e) => handleSearch(e.target.value)}
        style={{ width: 200 }}
      />

      {/* 方法过滤器 */}
      <Select
        mode="multiple"
        size="small"
        placeholder="方法"
        value={filters.methods}
        onChange={handleMethodChange}
        style={{ minWidth: 100 }}
        maxTagCount={1}
        options={HTTP_METHODS.map((m) => ({ label: m, value: m }))}
      />

      {/* 状态码过滤器 */}
      <Select
        mode="multiple"
        size="small"
        placeholder="状态码"
        value={filters.statusRange}
        onChange={handleStatusChange}
        style={{ minWidth: 100 }}
        maxTagCount={1}
        options={STATUS_RANGES.map((s) => ({ label: s, value: s }))}
      />

      <Space style={{ marginLeft: 'auto' }}>
        {/* 录制域名设置 */}
        <Tooltip
          title={
            isDomainFilterActive
              ? `仅录制 ${recordDomains.length} 个域名`
              : '设置仅录制指定的域名'
          }
        >
          <Button
            size="small"
            icon={<GlobalOutlined />}
            onClick={openDomainModal}
            type={isDomainFilterActive ? 'primary' : 'default'}
            ghost={isDomainFilterActive}
          >
            录制域名
            {isDomainFilterActive && (
              <Tag color="blue" style={{ marginLeft: 4, marginRight: 0 }}>
                {recordDomains.length}
              </Tag>
            )}
          </Button>
        </Tooltip>
        {/* 收藏夹 */}
        <Button
          size="small"
          icon={<StarOutlined />}
          onClick={() => setView('favorites')}
        >
          收藏夹
        </Button>
        {/* Map Remote */}
        <Button
          size="small"
          icon={<ApiOutlined />}
          onClick={() => setView('mapRemote')}
        >
          Map Remote
        </Button>
        {/* 清空按钮 */}
        <Button
          size="small"
          icon={<DeleteOutlined />}
          onClick={handleClear}
          danger
        >
          清空
        </Button>
      </Space>

      {/* 录制域名设置弹窗 */}
      <Modal
        title="默认录制域名设置"
        open={domainModalOpen}
        onOk={handleSaveDomainSettings}
        onCancel={() => setDomainModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={520}
        destroyOnClose
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Switch checked={draftEnabled} onChange={setDraftEnabled} />
          <span>启用域名过滤（仅录制下列域名的请求）</span>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Input
            size="small"
            placeholder="如：api.example.com 或 .example.com（后缀匹配）"
            value={domainInput}
            disabled={!draftEnabled}
            onChange={(e) => setDomainInput(e.target.value)}
            onPressEnter={handleAddDomain}
          />
          <Button
            size="small"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAddDomain}
            disabled={!draftEnabled}
          >
            添加
          </Button>
        </div>

        <div style={{ maxHeight: 260, overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 4 }}>
          {draftDomains.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无配置域名"
              style={{ padding: '16px 0' }}
            />
          ) : (
            <List
              size="small"
              dataSource={draftDomains}
              renderItem={(domain) => (
                <List.Item
                  actions={[
                    <Button
                      key="remove"
                      type="text"
                      size="small"
                      danger
                      icon={<CloseOutlined />}
                      onClick={() => handleRemoveDomain(domain)}
                    />,
                  ]}
                >
                  <span style={{ fontFamily: 'monospace' }}>{domain}</span>
                </List.Item>
              )}
            />
          )}
        </div>

        <div style={{ marginTop: 12, color: '#888', fontSize: 12, lineHeight: 1.6 }}>
          提示：
          <br />• 输入 <code>example.com</code> 将匹配该主域及其所有子域名
          <br />• 输入 <code>.example.com</code> 仅匹配子域名
          <br />• 关闭开关或列表为空时，将录制所有域名
        </div>
      </Modal>
    </div>
  );
};

export default FilterBar;