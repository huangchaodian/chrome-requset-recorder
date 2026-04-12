import React, { useEffect, useCallback } from 'react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import FilterBar from './components/FilterBar';
import RequestList from './components/RequestList';
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
  const view = useRequestStore((s) => s.view);
  const setView = useRequestStore((s) => s.setView);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const { getRequests } = useMessageBridge();

  // 初始化：加载请求列表和设置
  useEffect(() => {
    (async () => {
      try {
        const [requests, settings] = await Promise.all([
          getRequests(),
          sendMessage<Settings>(MessageType.GET_SETTINGS),
        ]);
        setRequests(requests);
        setSettings(settings);
      } catch (err) {
        console.error('[DevTools] Init failed:', err);
      }
    })();
  }, [getRequests, setRequests, setSettings]);

  // 监听新请求广播
  const handleNewRequest = useCallback(
    (record: RequestRecord) => {
      addRequest(record);
    },
    [addRequest]
  );
  useNewRequestListener(handleNewRequest);

  // 视图路由
  const renderView = () => {
    switch (view) {
      case 'list':
        return <RequestList />;
      case 'detail':
        return <RequestDetail />;
      case 'edit':
        return <RequestEditor />;
      case 'compare':
        return <DiffViewer />;
      case 'favorites':
        return <FavoriteList />;
      default:
        return <RequestList />;
    }
  };

  return (
    <ConfigProvider locale={zhCN}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <FilterBar />
        {renderView()}
      </div>
    </ConfigProvider>
  );
};

export default App;