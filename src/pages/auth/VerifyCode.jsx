import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, MessageSquare, Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Navbar from '../../shared/components/common/Navbar';

const VerifyCode = () => {
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [timer, setTimer] = useState(60);
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const email = location.state?.email || 'your email';

    useEffect(() => {
        let interval;
        if (timer > 0) {
            interval = setInterval(() => setTimer(timer - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [timer]);

    const handleChange = (index, value) => {
        if (value.length > 1) value = value[value.length - 1];
        const newCode = [...code];
        newCode[index] = value;
        setCode(newCode);

        // Move to next input
        if (value && index < 5) {
            document.getElementById(`code-${index + 1}`).focus();
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            document.getElementById(`code-${index - 1}`).focus();
        }
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        const fullCode = code.join('');
        if (fullCode.length < 6) {
            toast.error(t("verify.errorLength") || "Please enter the full 6-digit code");
            return;
        }

        setLoading(true);
        try {
            // Mock verification
            await new Promise(resolve => setTimeout(resolve, 1500));
            toast.success(t("verify.success") || "Code verified successfully!");
            navigate('/login');
        } catch (error) {
            toast.error(t("verify.error") || "Invalid verification code");
        } finally {
            setLoading(false);
        }
    };

    const handleResend = () => {
        if (timer > 0) return;
        setTimer(60);
        toast.success(t("verify.resent") || "Verification code resent to your email");
    };

    const containerVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.6, staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <>
            <Navbar />
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
                {/* Decorative orbs */}
                <div className="absolute top-1/4 -left-12 w-64 h-64 bg-emerald-400/10 dark:bg-emerald-400/5 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 -right-12 w-64 h-64 bg-teal-400/10 dark:bg-teal-400/5 rounded-full blur-3xl" />

                <motion.div
                    className="max-w-md w-full space-y-8 bg-white/80 dark:bg-gray-800/90 backdrop-blur-md p-10 rounded-2xl shadow-2xl border border-white/50 dark:border-gray-700/50 relative z-10"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                >
                    <motion.div className="text-center" variants={itemVariants}>
                        <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mb-6">
                            <ShieldCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 italic">
                            Verify <span className="text-emerald-500">Identity</span>
                        </h2>
                        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                            We've sent a 6-digit verification code to
                        </p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-200 mt-1">
                            {email}
                        </p>
                    </motion.div>

                    <form onSubmit={handleVerify} className="mt-8 space-y-8">
                        <motion.div className="flex justify-between gap-2" variants={itemVariants}>
                            {code.map((digit, index) => (
                                <input
                                    key={index}
                                    id={`code-${index}`}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={(e) => handleChange(index, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(index, e)}
                                    className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white/50 dark:bg-gray-700/50 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-0 transition-all outline-none text-gray-900 dark:text-white"
                                />
                            ))}
                        </motion.div>

                        <motion.button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            variants={itemVariants}
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                "Verify Code"
                            )}
                        </motion.button>
                    </form>

                    <motion.div className="text-center space-y-4" variants={itemVariants}>
                        <div className="text-sm">
                            <span className="text-gray-500 dark:text-gray-400">Didn't receive the code? </span>
                            <button
                                onClick={handleResend}
                                disabled={timer > 0}
                                className={`font-semibold transition-colors ${timer > 0 ? 'text-gray-400 cursor-not-allowed' : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-500'}`}
                            >
                                {timer > 0 ? `Resend in ${timer}s` : "Resend Code"}
                            </button>
                        </div>

                        <button
                            onClick={() => navigate('/login')}
                            className="inline-flex items-center text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-emerald-500 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Login
                        </button>
                    </motion.div>
                </motion.div>
            </div>
        </>
    );
};

export default VerifyCode;
