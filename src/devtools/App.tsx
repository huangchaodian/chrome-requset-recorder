import React, { useEffect, useCallback } from 'react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import FilterBar from './components/FilterBar';
import SidePanel from './components/SidePanel';
import RequestDetail from './components/RequestDetail';
import RequestEditor from './components/RequestEditor';
import DiffViewer from './components/DiffViewer';
import FavoriteList from './components/FavoriteList';
import { useRequestStore } from './stores/requestStore';
import { useSettingsStore } from './stores/settingsStore';
import { useMessageBridge, useNewRequestListener } from './hooks/useMessageBridge';
import { sendMessage } from './hooks/useMessageBridge';
import { MessageType } from '../shared/messageTypes';
import type { Settings, RequestRecord } from '../shared/types';
import './styles/global.css';

const App: React.FC = () => {
  const setRequests = useRequestStore((s) => s.setRequests);
  const addRequest = useRequestStore((s) => s.addRequest);
  const updateResponseBody = useRequestStore((s) => s.updateResponseBody);
  const setActiveRequest = useRequestStore((s) => s.setActiveRequest);
  const view = useRequestStore((s) => s.view);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const { getRequests } = useMessageBridge();

  // 初始化：加载请求列表和设置，并处理 URL 参数跳转
  useEffect(() => {
    (async () => {
      try {
        const [requests, settings] = await Promise.all([
          getRequests(),
          sendMessage<Settings>(MessageType.GET_SETTINGS),
        ]);
        setRequests(requests);
        setSettings(settings);

        // 检查 URL 参数中是否有 requestId，自动定位到该请求
        const params = new URLSearchParams(window.location.search);
        const targetId = params.get('requestId');
        if (targetId) {
          const target = requests.find((r) => r.id === targetId);
          if (target) {
            setActiveRequest(target);
          }
        }
      } catch (err) {
        console.error('[DevTools] Init failed:', err);
      }
    })();
  }, [getRequests, setRequests, setSettings, setActiveRequest]);

  // 监听新请求广播
  const handleNewRequest = useCallback(
    (record: RequestRecord) => {
      addRequest(record);
    },
    [addRequest]
  );
  useNewRequestListener(handleNewRequest);

  // 监听来自 background 的响应体更新广播
  useEffect(() => {
    const handler = (message: { type: string; payload: { id: string; responseBody: string } }) => {
      if (message.type === 'RESPONSE_BODY_UPDATED') {
        updateResponseBody(message.payload.id, message.payload.responseBody);
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [updateResponseBody]);

  // 右侧内容区：根据视图状态渲染
  const renderRightPanel = () => {
    switch (view) {
      case 'edit':
        return <RequestEditor />;
      case 'compare':
        return <DiffViewer />;
      case 'favorites':
        return <FavoriteList />;
      default:
        return <RequestDetail />;
    }
  };

  return (
    <ConfigProvider locale={zhCN}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {/* 顶部过滤栏 */}
        <FilterBar />

        {/* 左右分栏 */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* 左侧面板：20% */}
          <div style={{ width: '20%', minWidth: 200, maxWidth: 360, flexShrink: 0, overflow: 'hidden' }}>
            <SidePanel />
          </div>

          {/* 右侧内容区：80% */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {renderRightPanel()}
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default App;