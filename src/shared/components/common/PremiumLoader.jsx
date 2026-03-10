import React from 'react';
import { motion } from 'framer-motion';

const PremiumLoader = () => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white dark:bg-gray-950">
            <div className="relative flex flex-col items-center">
                {/* Animated Orbs */}
                <motion.div
                    className="absolute -top-20 -left-20 w-40 h-40 bg-emerald-400/10 dark:bg-emerald-400/5 rounded-full blur-3xl"
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 0.8, 0.5],
                    }}
                    transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
                <motion.div
                    className="absolute -bottom-20 -right-20 w-40 h-40 bg-teal-400/10 dark:bg-teal-400/5 rounded-full blur-3xl"
                    animate={{
                        scale: [1.2, 1, 1.2],
                        opacity: [0.8, 0.5, 0.8],
                    }}
                    transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />

                {/* Logo Container */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="relative z-10"
                >
                    <div className="relative w-24 h-24 sm:w-32 sm:h-32">
                        {/* Pulsing ring around logo */}
                        <motion.div
                            className="absolute inset-0 border-4 border-emerald-500 rounded-full"
                            animate={{
                                scale: [1, 1.2, 1],
                                opacity: [0.5, 0, 0],
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeOut",
                            }}
                        />
                        <img
                            src="/CareSync-Logo.png"
                            alt="CareSync Logo"
                            className="relative z-10 w-full h-full object-contain"
                        />
                    </div>
                </motion.div>

                {/* Brand Name */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.6 }}
                    className="mt-8 text-center"
                >
                    <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 italic">
                        Care<span className="text-emerald-500">Sync</span>
                    </h1>
                    <motion.div
                        className="mt-4 h-1 w-48 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mx-auto"
                    >
                        <motion.div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
                            animate={{
                                x: [-192, 192],
                            }}
                            transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                ease: "easeInOut",
                            }}
                        />
                    </motion.div>
                    <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400 animate-pulse">
                        Connecting Care, Syncing Health
                    </p>
                </motion.div>
            </div>
        </div>
    );
};

export default PremiumLoader;
