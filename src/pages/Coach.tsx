import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserCircle,
  Plus,
  Mail,
  Users,
  ClipboardList,
  BarChart3,
  MessageSquare,
  Settings,
  ChevronRight,
} from 'lucide-react';
import Layout from '@/components/Layout';
import StatsCards from '@/components/coach/StatsCards';
import ClientsTab from '@/components/coach/ClientsTab';
import ProgramsTab from '@/components/coach/ProgramsTab';
import AnalyticsTab from '@/components/coach/AnalyticsTab';
import MessagesTab from '@/components/coach/MessagesTab';
import SettingsTab from '@/components/coach/SettingsTab';

type TabId = 'clients' | 'programs' | 'analytics' | 'messages' | 'settings';

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

const tabs: TabDef[] = [
  { id: 'clients', label: 'Clients', icon: Users },
  { id: 'programs', label: 'Programs', icon: ClipboardList },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const tabContentVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.15 },
  },
};

export default function Coach() {
  const [activeTab, setActiveTab] = useState<TabId>('clients');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'clients':
        return <ClientsTab />;
      case 'programs':
        return <ProgramsTab />;
      case 'analytics':
        return <AnalyticsTab />;
      case 'messages':
        return <MessagesTab />;
      case 'settings':
        return <SettingsTab />;
      default:
        return <ClientsTab />;
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-[1200px] space-y-4 p-4 lg:p-6">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
          }}
        >
          {/* Breadcrumb */}
          <div
            className="mb-2 flex items-center gap-1 text-xs"
            style={{ color: 'var(--light-text-muted)' }}
          >
            <span className="font-medium">AzFIT</span>
            <ChevronRight size={12} />
            <span>Coach</span>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl lg:h-11 lg:w-11"
                style={{ backgroundColor: 'rgba(13, 148, 136, 0.15)' }}
              >
                <UserCircle
                  size={22}
                  className="lg:h-6 lg:w-6"
                  style={{ color: '#0D9488' }}
                />
              </div>
              <div>
                <h1
                  className="text-2xl font-bold tracking-tight lg:text-[32px]"
                  style={{
                    color: 'var(--page-text)',
                    textShadow: 'var(--text-shadow-dark)',
                  }}
                >
                  Coach Dashboard
                </h1>
                <p
                  className="text-xs lg:text-sm"
                  style={{ color: 'var(--light-text-secondary)' }}
                >
                  Manage your clients and programs
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 active:scale-[0.97]"
                style={{
                  backgroundColor: '#0D9488',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#14B8A6';
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(13,148,136,0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#0D9488';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <Plus size={16} />
                New Program
              </button>
              <button
                className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-all duration-150 active:scale-[0.97]"
                style={{
                  borderColor: 'var(--card-border)',
                  color: 'var(--page-text)',
                  backgroundColor: 'var(--card-bg)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--light-elevated)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--card-bg)';
                }}
              >
                <Mail size={16} />
                Message All
              </button>
            </div>
          </div>
        </motion.div>

        {/* Stats Overview */}
        <StatsCards />

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.4,
            delay: 0.3,
            ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
          }}
        >
          {/* Custom Tab Bar */}
          <div
            className="mb-4 flex gap-1 overflow-x-auto rounded-xl p-1 lg:gap-2"
            style={{ backgroundColor: 'var(--light-elevated)' }}
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200 active:scale-[0.97] lg:px-4 lg:text-sm"
                  style={{
                    color: isActive
                      ? '#FFFFFF'
                      : 'var(--light-text-muted)',
                  }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeCoachTab"
                      className="absolute inset-0 rounded-lg"
                      style={{
                        backgroundColor: '#0D9488',
                      }}
                      transition={{
                        type: 'spring',
                        stiffness: 300,
                        damping: 30,
                      }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    <Icon size={16} />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={tabContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </Layout>
  );
}
