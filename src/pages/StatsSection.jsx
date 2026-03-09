import { UsersIcon, HeartIcon, ClockIcon, ShieldCheckIcon, BuildingOffice2Icon, CodeBracketIcon } from '@heroicons/react/24/outline';
import CountUp from 'react-countup';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

export default function StatsSection() {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const [startCount, setStartCount] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const section = document.getElementById('stats-section');
      if (section && section.getBoundingClientRect().top < window.innerHeight - 100) {
        setStartCount(true);
        window.removeEventListener('scroll', onScroll);
      }
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const stats = [
    { 
      labelKey: 'stats.betaPartners.label', 
      value: 25, 
      suffix: '+', 
      icon: BuildingOffice2Icon,
      descriptionKey: 'stats.betaPartners.description'
    },
    { 
      labelKey: 'stats.activeUsers.label', 
      value: 150, 
      suffix: '+', 
      icon: UsersIcon,
      descriptionKey: 'stats.activeUsers.description'
    },
    { 
      labelKey: 'stats.patients.label', 
      value: 750, 
      suffix: '+', 
      icon: HeartIcon,
      descriptionKey: 'stats.patients.description'
    },
    { 
      labelKey: 'stats.uptime.label', 
      value: 99.2, 
      suffix: '%', 
      icon: ShieldCheckIcon,
      descriptionKey: 'stats.uptime.description'
    },
  ];

  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.15, duration: 0.6, ease: "easeOut" }
    })
  };

  return (
    <section 
      id="stats-section" 
      className="py-20 bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 text-emerald-700 dark:text-emerald-300 px-4 py-2 rounded-full text-sm font-semibold shadow-sm border border-emerald-200 dark:border-emerald-800 mb-6">
            <CodeBracketIcon className="w-4 h-4 mr-2" />
            {t('stats.headerBadge', 'वर्तमान में विकासाधीन')}
          </div>
          
          <h2 className="text-3xl lg:text-4xl font-black text-gray-900 dark:text-gray-100 mb-4">
            {t('stats.titleLine1', 'स्वास्थ्य देखभाल का भविष्य')}
            <span className="gradient-accent bg-clip-text text-transparent"> {t('stats.titleAccent', 'बना रहे हैं')}</span>
          </h2>
          
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {t('stats.subtitle', "हम स्वास्थ्य पेशेवरों के साथ मिलकर एक ऐसा प्लेटफ़ॉर्म बना रहे हैं जो वास्तव में उनकी जरूरतों को पूरा करे। अब तक हमारी प्रगति यहां है।")}
          </p>
        </motion.div>

        {/* Stats Grid */}
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              className="group text-center bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl p-8 border border-white/50 dark:border-gray-700/50 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
              custom={index}
              variants={cardVariants}
            >
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <stat.icon className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>

              <div className="text-4xl font-black text-gray-900 dark:text-gray-100 mb-2">
                {startCount && (
                  <CountUp
                    start={0}
                    end={stat.value}
                    duration={2.5}
                    separator=","
                    decimals={stat.value % 1 !== 0 ? 1 : 0}
                    suffix={stat.suffix}
                  />
                )}
              </div>

              <div className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                {t(stat.labelKey)}
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {t(stat.descriptionKey)}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Beta Program Banner */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 p-8">
            <div className="flex items-center justify-center mb-4">
              <div className="flex space-x-1">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
            
            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
              {t('stats.betaProgram.title')}
            </h3>
            
            <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-2xl mx-auto">
              {t('stats.betaProgram.description')}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="gradient-accent text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300">
                {t('stats.betaProgram.requestAccess')}
              </button>
              <button className="border-2 border-blue-500 text-blue-600 dark:text-blue-400 px-8 py-3 rounded-xl font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-300">
                {t('stats.betaProgram.viewRoadmap')}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Development Timeline */}

      </div>
    </section>
  );
}
