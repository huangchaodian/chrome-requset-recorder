import React, { useCallback } from 'react';
import { Input, Select, Button, Tag, Space } from 'antd';
import {
  SearchOutlined,
  DeleteOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  StarOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { useRequestStore } from '../stores/requestStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useMessageBridge } from '../hooks/useMessageBridge';
import { HTTP_METHODS, STATUS_RANGES } from '../../shared/constants';

const FilterBar: React.FC = () => {
  const filters = useRequestStore((s) => s.filters);
  const setFilters = useRequestStore((s) => s.setFilters);
  const clearAll = useRequestStore((s) => s.clearAll);
  const setView = useRequestStore((s) => s.setView);
  const isRecording = useSettingsStore((s) => s.isRecordingEnabled);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const { clearRequests, toggleRecording } = useMessageBridge();

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
    </div>
  );
};

export default FilterBar;