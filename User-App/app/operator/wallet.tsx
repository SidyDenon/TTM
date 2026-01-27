import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Animated,
  useWindowDimensions,
  Pressable,
} from "react-native";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { API_URL } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatCurrency } from "../../utils/format";
import * as Haptics from "expo-haptics";
import Toast from "react-native-toast-message";
import { useSocket } from "../../context/SocketContext";
import Loader from "../../components/Loader";
import { SvgXml } from "react-native-svg/lib/commonjs";

const RED = "#E53935";
const BG = "#F6F6F6";
const BORDER = "#E5E7EB";
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const STAT_AMOUNT_SIZE =
  SCREEN_WIDTH <= 340 ? 11 : SCREEN_WIDTH <= 360 ? 12 : SCREEN_WIDTH <= 380 ? 13 : 11;
const WALLET_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none" fill-rule="evenodd" clip-rule="evenodd"><path fill="#14AE5C" d="M19.773 8.259c.998-1.947 2.856-5.652.689-5.941a33 33 0 0 0-5.222-.36q.072-.446.07-.898C15.25-.238 13.493.02 12.983.02a4.9 4.9 0 0 0-1.487.16C8.13.91 8.36.75 7.272 1.02a10.2 10.2 0 0 0-2.566.998a1.19 1.19 0 0 0-.45 1.198c0 .24.74 3.485.89 4.064c.259 1.058.369 1.228.908 3.415c.07.29.08.799.51.839a.3.3 0 0 0 .329-.27c0-.33-.51-1.588-1.119-5.681c1.219.29 3.505-1.987 3.216-3.814c2.995-.57 2.765-.85 3.993-.89c.39 0 1.348-.219 1.588.1c.1.13 0 .83.05 1c-.52 0-3.235.159-3.595.548a3.47 3.47 0 0 0-.499 1.887c-.06.46-.639 5.422-.559 5.861a.32.32 0 0 0 .38.31c.16 0 .848-4.573.858-4.653a2.49 2.49 0 0 0 2.247-.49a3.07 3.07 0 0 0 1.318-2.356h2.476a2.686 2.686 0 0 0 2.486 3.325c-.2.5-.42.999-.649 1.508l-.3.829c-.13.4.49.729.66.34c.05-.14-.04.09.329-.83M5.675 4.904c-.1-.7-.29-1.628-.29-1.648c-.09-.719.15-.44.819-.719A10.3 10.3 0 0 1 8.2 1.938c-.14.78-1.748 2.846-2.526 2.966m7.209-.44c-1.258.999-.999.7-1.558.78q.123-.93.35-1.838c.09 0 .998-.19 2.386-.28c-.16.56-.879 1.089-1.178 1.338m5.9.37c-.998-.999-.828-1.588-.848-1.678c.809 0 1.617.11 2.406.19c.42 0-.17 1.887-.31 2.297a2.55 2.55 0 0 1-1.247-.81"/><path fill="#E5372E" d="M22.509 14.799c-.26-1.129-.949-1.997-2.107-1.868c-.14-.24.42-2.396-1.258-3.145a2.1 2.1 0 0 0-.67-.2c-.48-.07-.97.03-1.387.28c-.53.25-2.766.919-2.766.939c-.469.12-4.992.928-6.26.998c-1.458.05-3.874-.15-2.936-1.288a.31.31 0 0 0 0-.42c-.389-.329-.858.54-.828 1.06c.07 1.287 2.506 1.657 3.794 1.707c4.194.15 9.326-2.077 9.565-2.557c1.498.25 1.827 1.418 2.067 2.996c-.53.749-1.138.37-2.806.729c-1.248.27-1.997.878-1.927 2.156a2.37 2.37 0 0 0 1.488 2.147q.441.143.899.22a5.4 5.4 0 0 0 2.526-.05c-.1 2.775-.41 2.766-1.997 3.305c-2.566.838-10.744 1.727-12.98.34c-1.378-.76-1.598-2.158-1.927-3.585a26.8 26.8 0 0 1-.76-5.691c-.049-3.066.16-3.096 1.998-4.424a.34.34 0 0 0-.39-.549C1.85 9.287 1.491 9.507 1.431 12.891a27 27 0 0 0 .57 5.891c.369 1.788.618 3.325 2.236 4.334c3.185 1.997 14.438.25 15.766-1.668a6 6 0 0 0 .509-3.145a3.055 3.055 0 0 0 1.997-3.505m-4.903 2.665a2.65 2.65 0 0 1-1.108-.359c-.53-.43-.729-1.508-.14-1.887c1.398-.889 3.215-.14 3.994-1.618c.09 0 1.158-.31 1.408 1.348c.26 2.047-2.197 2.976-4.154 2.516"/><path fill="#14AE5C" d="M15.849 9.207a2.8 2.8 0 0 1 1.128-.2c.09.51.999.31.929-.09c-.09-.718-.52-.918-1.258-.998a2.13 2.13 0 0 0-1.907.869a2.06 2.06 0 0 0-.27 1.128c-.09.39.809.3.819-.06c.19-.45.29-.53.559-.649"/></g></svg>`;
const MONEY_SACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><ellipse cx="10.97" cy="52.578" fill="#14ae5c" rx="1.742" ry="1.188"/><path fill="#14ae5c" d="m62 46.669l-.654-.384c-.05-.029-5.047-2.994-6.289-6.592l-.277-.797l-.512.669c-.016.021-.726.899-2.713 1.929c-1.471-8.373-6.475-18.369-13.051-22.631c1.88.152 3.766-.004 5.586-.666c1.096-.398.623-2.184-.483-1.78c-1.492.543-2.987.691-4.479.615c3.663-3.357 6.539-8.502 6.539-12.264c0-.904 0-2.587-1.34-2.587c-.538 0-.973.336-1.574.8c-.922.711-2.314 1.787-4.359 1.787c-.779 0-2.205-.822-3.351-1.482C33.658 2.489 32.773 2 32.029 2c-1.232 0-3.043.996-4.641 1.875c-.65.357-1.539.847-1.723.894c-2.316 0-3.661-1.068-4.553-1.775c-.52-.414-.897-.714-1.4-.714c-1.318 0-1.318 1.581-1.318 3.412c0 3.534 2.692 8.199 6.217 11.334c-2.221.159-4.411.83-5.95 2.321c-.85.822.438 2.126 1.285 1.306c1.279-1.24 2.956-1.771 4.75-1.874q.076.274.189.54C17.369 24.72 12.03 37.545 12.03 46.203c0 .854.066 1.627.168 2.355c-1.938-.861-2.645-1.616-2.659-1.633l-.516-.595l-.254.75c-1.123 3.304-6.005 6.17-6.054 6.199L2 53.694l.727.393c.255.138.508.259.763.39l-.46.319l.243 3.04L22.326 62l7.224-4.621q1.093.006 2.218.006L40.212 62l19.089-6v-3.209l-.505-.303q.378-.24.755-.491l.669-.447l-.147-.072l.851-.233l.144-3.336l-.492-.349q.393-.235.785-.483zM20.213 5.692c0-.444.006-.79.015-1.059c.153.12.331.251.521.386c.583 1.396 1.686 3.406 3.556 4.672c2.272 1.54 1.97-.23 3.182-1.846c1.212-1.615 2.032-2.461 4.062 1.693c.885 1.811 2.36-3.25 3.762-3.989c.371.202.741.39 1.104.55c2.514 4.088 3.679 2.813 5.912-.585c.614-.36 1.118-.746 1.519-1.055q.003.139.004.311c0 3.21-2.623 7.814-5.835 10.817a3.6 3.6 0 0 0-.642-1.053c-1.297-1.469-3.324.16-4.285 1.229c-1.705-.548-4.483-2.057-6.293-1.193a4.6 4.6 0 0 0-1.226.831c-2.96-2.698-5.356-6.593-5.356-9.709m16.204 10.974a27 27 0 0 1-1.337-.32c.558-.481 1.07-.649 1.285.066c.023.078.037.167.052.254m-7.6.621q-.496-.096-1.021-.165a14 14 0 0 1-.779-.525c.914-.613 2.49-.287 3.996.224c-.743.075-1.476.237-2.196.466m.454 2.64c-.56.14-1.17.084-1.697-.126c.214-.113.43-.211.646-.31c.35.169.7.31 1.051.436M10.774 56.379a39.3 39.3 0 0 1-6.912-2.733c1.357-.892 4.313-3.049 5.515-5.641c.824.647 2.726 1.827 6.43 2.733c-.063.102-.14.211-.214.318c-3.162-.828-4.96-1.875-4.989-1.893l-.436-.26l-.209.467c-.275.612-.92.704-1.279.704c-.1 0-.167-.007-.176-.008l-.357-.052l-.13.342c-.266.698-1.358 1.61-1.758 1.903l-.668.49l.764.313c.284.116.361.223.365.251c.01.069-.111.251-.24.356l-.582.469l.677.313c1.387.64 2.958 1.17 4.529 1.607q-.186.183-.33.321m8.064-3.726c1.398.196 2.947.32 4.639.32h.001q.527 0 1.073-.017a1 1 0 0 0 .103.213q.133.203.361.334l-2.552 2.181l-.146-.003c-1.137 0-1.985.418-2.392 1.162a69 69 0 0 1-4.602-.747a51 51 0 0 0 3.515-3.443M7.489 53.85c.1-.189.165-.418.13-.668a1 1 0 0 0-.307-.59c.449-.385 1.068-.979 1.408-1.594c.773-.011 1.411-.304 1.813-.822c.677.354 2.202 1.069 4.455 1.689c-.921 1.155-2.162 2.465-3.127 3.439c-1.504-.398-3.019-.878-4.372-1.454m14.251 4.209l-.205.001c-.861 0-3.714-.07-7.483-.855c.132-.112.269-.227.396-.337c3.058.639 5.524.913 5.709.934l.366.039l.113-.355c.247-.766 1.158-.879 1.68-.879c.143 0 .238.009.249.01l.194.021l4.433-3.788l-1.185-.039c-.396-.014-.563-.103-.604-.164l.251-.657l-.694.029q-.759.033-1.483.033h-.001c-1.396 0-2.691-.092-3.888-.237l.278-.328c2.416.323 5.309.522 8.802.497c-.834 1.17-2.914 3.657-6.928 6.075m10.024-4.345v1.825q-.853 0-1.665-.006l-.163-2.054l-1.354.11c.912-1.078 1.301-1.797 1.336-1.862l.367-.694l-.775.014c-7.418.136-12.256-.748-15.31-1.73c-.223-.902-.352-1.922-.352-3.113c0-8.123 5.191-20.401 12.083-25.377c1.221 1.181 3.073 1.698 4.833.549c.386-.252.722-.582 1.037-.933c.075.002.152.019.228.019c.252 0 .508-.021.763-.053c.323.129.639.259.932.388c1.403.618 2.601.234 3.419-.618c6.313 3.82 11.371 13.925 12.702 22.093c-2.886 1.154-7.464 2.28-14.49 2.478c1.386-.792 2.426-2.124 2.052-3.874c-.393-1.85-1.939-2.37-3.54-2.455q-.007-1.302.002-2.605c.491.217.962.467 1.39.734c.756.475 1.44-.756.689-1.231a10.3 10.3 0 0 0-2.072-.999q.015-1.508.015-3.014c.001-.92-1.366-.92-1.366 0q-.001 1.325-.014 2.646a7.1 7.1 0 0 0-2.202-.037a27 27 0 0 0-.432-1.97c-.226-.886-1.546-.511-1.317.378c.168.639.305 1.275.418 1.92c-.058.022-.121.033-.178.059c-1.852.733-2.982 2.602-1.627 4.345c.631.812 1.456 1.14 2.359 1.249c.049 1.203.08 2.407.115 3.609c-.605-.393-1.156-.897-1.655-1.43c-.618-.652-1.583.355-.966 1.006c.839.893 1.72 1.568 2.675 2c.043 1.027.104 2.057.204 3.079c.088.907 1.456.912 1.367 0a54 54 0 0 1-.187-2.657c.52.09 1.066.113 1.646.058c.065.946.141 1.892.249 2.838c.062.542.58.755.962.645l-.085 1.964c-.602.054-1.216.104-1.856.146l-.762.05l.406.656c.041.066.502.795 1.531 1.856h-1.412zm24.888-6.582c-1.257.591-2.847 1.133-4.467 1.606c-.996-1.029-2.27-2.402-3.221-3.62c2.119-.642 3.305-1.304 3.84-1.661c.423.373.983.567 1.646.566c.22 0 .415-.021.565-.045c.48.622 1.254 1.34 1.738 1.769q-.344.353-.331.776c.008.24.104.444.23.609m-7.155 3.286q.307.27.63.55c-4.054 1.075-7.071 1.192-7.728 1.203c-4.198-2.561-6.374-5.271-7.213-6.491c3.513-.088 6.417-.406 8.839-.844a24 24 0 0 0 .299.36a53 53 0 0 1-5.877.583l-.807.034l.444.679c-.001.001-.091.169-.687.285l-.969.189l4.764 3.857l.222-.06c-.005-.001-.425-.114.933-.114c.733 0 1.234.223 1.486.659l.16.276l.311-.055a87 87 0 0 0 5.193-1.111M35.4 47.479l-1.138-.062c-.053-.568-.106-1.136-.146-1.704c.2.332.61.956 1.284 1.766m-1.408-3.661a105 105 0 0 1-.119-4.041q.248.01.48.043c1.768.268 2.23 2.234.85 3.34c-.36.285-.775.494-1.211.658m10.439 6.752c-.448-.553-1.161-.843-2.083-.843c-.385 0-.724.052-.938.094l-2.995-2.427q.372-.214.509-.546a1 1 0 0 0 .052-.171c2.374-.13 4.374-.367 6.065-.657c.82.915 2.025 2.177 3.623 3.644c-1.963.467-3.6.787-4.233.906M32.505 39.813c.019 1.449.055 2.902.132 4.35c-.129.02-.256.045-.383.058c-.43.049-.838.013-1.226-.085c-.049-1.4-.081-2.803-.134-4.204c.538-.025 1.083-.078 1.611-.119m-1.68-1.265a44 44 0 0 0-.31-3.286a5.3 5.3 0 0 1 1.987.101a285 285 0 0 0-.005 3.067c-.439.024-.856.066-1.223.099a6 6 0 0 1-.449.019m-1.372-.175c-.085-.023-.169-.041-.256-.07a2.7 2.7 0 0 1-1.057-.667c-.854-.797.318-1.579 1.057-1.95c.116.89.196 1.788.256 2.687M40.49 57.839c-4.341-2.218-6.67-4.683-7.595-5.825c.665-.05 1.294-.11 1.917-.173l7.118 4.62l15.61-4.288c-8.05 4.852-16.003 5.591-17.05 5.666m12.892-7.89l-.462-.463c1.776-.538 3.494-1.162 4.775-1.848l.779-.419l-.79-.402c-.177-.091-.35-.258-.353-.321c.002-.024.072-.152.375-.326l.578-.332l-.514-.428c-.016-.013-1.619-1.344-2.182-2.201l-.186-.28l-.319.093c-.003 0-.277.079-.633.079c-.55.001-.962-.179-1.226-.533l-.292-.387l-.366.315c-.019.016-1.152.945-4.191 1.823a10 10 0 0 1-.289-.44c3.685-1.117 5.568-2.469 6.384-3.209c1.31 2.834 4.429 5.117 5.783 6.012a38 38 0 0 1-6.871 3.267"/><path fill="#14ae5c" d="M44.38 47.117c-.997-.271-2.122-.086-2.516.409c-.391.497.103 1.123 1.099 1.396c.998.271 2.122.085 2.516-.411c.391-.497-.101-1.121-1.099-1.394"/></svg>`;
const formatNumber = (value: number) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0 }).format(value);

type Transaction = {
  id: number;
  request_id?: number;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  type: "gain" | "retrait";
};

const DEFAULT_COMMISSION = 12; // % aligné avec dashboard admin

export default function WalletScreen() {
  const { token } = useAuth();
  const { socket } = useSocket();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const heroTranslate = React.useRef(new Animated.Value(-30)).current;
  const retraitTranslate = React.useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const retraitHeaderTranslate = React.useRef(new Animated.Value(-20)).current;
  const todayAnim = React.useRef(new Animated.Value(0)).current;
  const monthAnim = React.useRef(new Animated.Value(0)).current;
  const [displayToday, setDisplayToday] = useState(0);
  const [displayMonth, setDisplayMonth] = useState(0);
  const modalScale = React.useRef(new Animated.Value(0.96)).current;
  const modalOpacity = React.useRef(new Animated.Value(0)).current;

  const [solde, setSolde] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [commissionPercent, setCommissionPercent] = useState<number>(DEFAULT_COMMISSION);

  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState("Orange Money");
  const [screenMode, setScreenMode] = useState<"wallet" | "retrait" | "historique">("wallet");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const retraitListHeight = Math.max(320, screenHeight - 280);

  // ---------------------- FETCH WALLET ----------------------
  const fetchWallet = async () => {
    try {
      const res = await fetch(`${API_URL}/operator/wallet`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        Alert.alert("Erreur", data.error || "Impossible de charger le wallet");
        return;
      }

      if (data.commission_percent != null) {
        setCommissionPercent(Number(data.commission_percent));
      } else {
        setCommissionPercent((prev) =>
          Number.isFinite(prev) ? prev : DEFAULT_COMMISSION
        );
      }
      if (data.is_internal) {
        setCommissionPercent(0);
      }
      setSolde(data.solde || 0);
      setTransactions(data.transactions || []);
    } catch (err) {
      console.error("❌ Erreur fetchWallet:", err);
      Alert.alert("Erreur", "Impossible de charger vos gains");
    } finally {
      setLoading(false);
    }
  };

  const netAmount = useCallback(
    (amount: number) =>
      Math.max(0, Number(amount) * (1 - commissionPercent / 100)),
    [commissionPercent]
  );

  // ---------------------- CONFIRMER RETRAIT ----------------------
  const confirmerRetrait = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert("Erreur", "Veuillez saisir un montant valide");
      return;
    }
    if (!phone) {
      Alert.alert("Erreur", "Veuillez saisir un numéro de téléphone");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/operator/wallet/withdraw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: parseFloat(amount), phone, method }),
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Erreur", data.error || "Impossible de demander un retrait");
        return;
      }

      Alert.alert("✅ Succès", "Votre demande de retrait a été envoyée");
      setShowModal(false);
      setAmount("");
      setPhone("");
      setMethod("Orange Money");
      fetchWallet();
    } catch (err) {
      console.error("❌ Erreur retrait:", err);
      Alert.alert("Erreur", "Impossible de demander un retrait");
    }
  };

  // ---------------------- AUTO REFRESH (5s) ----------------------
  useEffect(() => {
    fetchWallet();
    const interval = setInterval(() => {
      fetchWallet();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    Animated.timing(heroTranslate, {
      toValue: 0,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [heroTranslate]);

  useEffect(() => {
    if (screenMode !== "wallet") {
      const fromLeft = screenMode === "historique";
      retraitTranslate.setValue(fromLeft ? -SCREEN_WIDTH : SCREEN_WIDTH);
      retraitHeaderTranslate.setValue(-20);
      Animated.parallel([
        Animated.timing(retraitTranslate, {
          toValue: 0,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.timing(retraitHeaderTranslate, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [screenMode, retraitTranslate, retraitHeaderTranslate]);

  useEffect(() => {
    if (showModal) {
      modalScale.setValue(0.96);
      modalOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(modalScale, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showModal, modalScale, modalOpacity]);

  // ---------------------- SOCKET EVENTS ----------------------
  useEffect(() => {
    if (!socket) return;

    type WithdrawalEvent = {
      id?: number;
      operator_id?: number;
      amount?: number;
      method?: string;
      phone?: string;
      status: "en_attente" | "approuvée" | "rejetée";
      message?: string;
      created_at?: string;
    };

    const handleCreated = (data: WithdrawalEvent) => {
      Toast.show({
        type: "info",
        text1: "📤 Retrait envoyé",
        text2: "Votre demande est en attente d’approbation",
        visibilityTime: 2500,
      });
      setTransactions((prev) => [
        {
          id: data.id || Date.now(),
          amount: data.amount || 0,
          currency: "FCFA",
          status: data.status || "en_attente",
          created_at: data.created_at || new Date().toISOString(),
          type: "retrait",
        },
        ...prev,
      ]);
    };

    const handleUpdated = (data: WithdrawalEvent) => {
      Haptics.notificationAsync(
        data.status === "approuvée"
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error
      );
      Toast.show({
        type: data.status === "approuvée" ? "success" : "error",
        text1:
          data.status === "approuvée"
            ? "💸 Retrait approuvé !"
            : "❌ Retrait rejeté",
        text2: data.message || "",
        visibilityTime: 3000,
      });
      setTransactions((prev) =>
        prev.map((t) =>
          t.type === "retrait" && t.id === data.id
            ? { ...t, status: data.status }
            : t
        )
      );
    };

    const handleNewTransaction = (data: any) => {
      if (data?.commission_percent != null) {
        setCommissionPercent(Number(data.commission_percent));
      }
      Toast.show({
        type: "info",
        text1: "🚗 Mission terminée",
        text2: `Nouveau gain : ${formatCurrency(netAmount(data.amount))}`,
        visibilityTime: 2500,
      });
      setSolde((s) => s + netAmount(data.amount));
      setTransactions((prev) => [
        {
          id: data.id || Date.now(),
          request_id: data.request_id,
          amount: data.amount,
          currency: data.currency || "FCFA",
          status: "confirmée",
          created_at: new Date().toISOString(),
          type: "gain",
        },
        ...prev,
      ]);
    };

    socket.on("withdrawal_created", handleCreated);
    socket.on("withdrawal_update", handleUpdated);
    socket.on("transaction_confirmed", handleNewTransaction);

    return () => {
      socket.off("withdrawal_created", handleCreated);
      socket.off("withdrawal_update", handleUpdated);
      socket.off("transaction_confirmed", handleNewTransaction);
    };
  }, [socket]);

  const gainsList = transactions.filter((t) => t.type === "gain");

  const todayKey = new Date().toDateString();
  const todayStats = gainsList.reduce(
    (acc, t) => {
      const d = new Date(t.created_at);
      if (d.toDateString() !== todayKey) return acc;
      acc.count += 1;
      acc.amount += netAmount(t.amount);
      return acc;
    },
    { count: 0, amount: 0 }
  );

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const monthStats = gainsList.reduce(
    (acc, t) => {
      const d = new Date(t.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (key !== monthKey) return acc;
      acc.count += 1;
      acc.amount += netAmount(t.amount);
      return acc;
    },
    { count: 0, amount: 0 }
  );

  const amountValue = Number.parseFloat(amount || "0");
  const exceedsBalance = Number.isFinite(amountValue) && amountValue > solde;

  useEffect(() => {
    const id = todayAnim.addListener(({ value }) => {
      setDisplayToday(value);
    });
    return () => {
      todayAnim.removeListener(id);
    };
  }, [todayAnim]);

  useEffect(() => {
    const id = monthAnim.addListener(({ value }) => {
      setDisplayMonth(value);
    });
    return () => {
      monthAnim.removeListener(id);
    };
  }, [monthAnim]);

  useEffect(() => {
    Animated.timing(todayAnim, {
      toValue: todayStats.amount,
      duration: 650,
      useNativeDriver: false,
    }).start();
  }, [todayStats.amount, todayAnim]);

  useEffect(() => {
    Animated.timing(monthAnim, {
      toValue: monthStats.amount,
      duration: 650,
      useNativeDriver: false,
    }).start();
  }, [monthStats.amount, monthAnim]);

  // ---------------------- RENDER ----------------------
  if (loading) {
    return (
      <View style={styles.loader}>
        <Loader />
        <Text style={{ marginTop: 10 }}>Chargement du wallet...</Text>
      </View>
    );
  }

  const retraits = transactions.filter((t) => t.type === "retrait");
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const today = new Date();
  const filterLabel =
    selectedDate && !isSameDay(selectedDate, today)
      ? selectedDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
      : "Aujourd’hui";
  const retraitsFiltered = selectedDate
    ? retraits.filter((t) => isSameDay(new Date(t.created_at), selectedDate))
    : retraits;
  const gainsFiltered = selectedDate
    ? gainsList.filter((t) => isSameDay(new Date(t.created_at), selectedDate))
    : gainsList;

  const monthLabel = calendarMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const startOfMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const endOfMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
  const startWeekday = (startOfMonth.getDay() + 6) % 7; // Monday=0
  const daysInMonth = endOfMonth.getDate();
  const calendarDays: Array<number | null> = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const getStatusColor = (status: string) => {
    if (status === "approuvée" || status === "confirmée" || status === "confirmé") return "#16A34A";
    if (status === "en_attente") return "#F59E0B";
    if (status === "refusée" || status === "rejetée") return "#EF4444";
    return "#6B7280";
  };
  const getAmountPrefix = (status: string) => (status === "approuvée" ? "- " : "");
  const getAmountPrefixGain = () => "+ ";
  const goWallet = () => {
    if (screenMode === "wallet") return;
    const toLeft = screenMode === "historique";
    Animated.parallel([
      Animated.timing(retraitTranslate, {
        toValue: toLeft ? -SCREEN_WIDTH : SCREEN_WIDTH,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(retraitHeaderTranslate, {
        toValue: -20,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setScreenMode("wallet");
      requestAnimationFrame(() => {
        heroTranslate.setValue(-20);
        Animated.timing(heroTranslate, {
          toValue: 0,
          duration: 320,
          useNativeDriver: true,
        }).start();
      });
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {commissionPercent === 0 ? (
          <View style={styles.hiddenBox}>
            <MaterialIcons name="info-outline" size={26} color="#E53935" />
            <Text style={styles.hiddenTitle}>Wallet désactivé</Text>
            <Text style={styles.hiddenSubtitle}>
              Les opérateurs internes ne sont pas soumis à commission et n’utilisent pas le wallet.
            </Text>
          </View>
        ) : screenMode === "wallet" ? (
          <>
            <View style={styles.heroShadow}>
              <Animated.View style={[styles.heroCard, { transform: [{ translateY: heroTranslate }] }]}>
                <Text style={styles.heroTitle}>Mes gains</Text>
                <View style={styles.heroCardTop}>
                  <Text style={styles.heroLabel}>Solde actuel</Text>
                  <TouchableOpacity style={styles.refreshBtn} onPress={() => fetchWallet()}>
                    <MaterialIcons name="refresh" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
                <View style={styles.heroAmountRow}>
                  <Text
                    style={styles.heroAmount}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {formatNumber(solde)}
                  </Text>
                  <Text style={styles.heroCurrency}>FCFA</Text>
                </View>
                <Text style={styles.heroSub}>
                  {commissionPercent === 0
                    ? "Commission TTM : 0%"
                    : `Après comission de ${commissionPercent}%`}
                </Text>
              </Animated.View>
            </View>

            <View style={styles.bodyWrap}>
              <View style={styles.statsCard}>
                <View style={styles.statsHeaderRow}>
                  <Text style={styles.statsHeader}>Aujourd’hui</Text>
                  <Text style={styles.statsHeader}>Ce mois</Text>
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <View style={styles.statIconWrap}>
                      <MaterialCommunityIcons name="cash" size={18} color="#16A34A" />
                    </View>
                    <View>
                      <Text
                        style={styles.statAmount}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.6}
                      >
                        + {formatCurrency(displayToday)}
                      </Text>
                      <Text style={styles.statSub}>
                        {todayStats.count} mission{todayStats.count > 1 ? "s" : ""}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.statBox}>
                    <View style={styles.statIconWrapBlue}>
                      <MaterialIcons name="calendar-month" size={18} color="#1F6FEB" />
                    </View>
                    <View>
                      <Text
                        style={styles.statAmountBlue}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.6}
                      >
                        + {formatCurrency(displayMonth)}
                      </Text>
                      <Text style={styles.statSub}>
                        {monthStats.count} mission{monthStats.count > 1 ? "s" : ""}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.withdrawCard}>
                <View style={styles.withdrawHeader}>
                  <View style={styles.withdrawTextBlock}>
                    <Text style={styles.withdrawTitle}>Demander un retrait</Text>
                    <View style={styles.withdrawList}>
                      <View style={styles.withdrawListRow}>
                        <MaterialCommunityIcons name="shield-check" size={16} color="#111" />
                        <Text style={styles.withdrawListItem}>Paiement sécurisé</Text>
                      </View>
                      <View style={styles.withdrawListRow}>
                        <MaterialCommunityIcons name="check-bold" size={16} color="#111" />
                        <Text style={styles.withdrawListItem}>
                          Les retraits sont traités sous 24h
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.withdrawIllustration}>
                    <SvgXml xml={WALLET_SVG} width={58} height={108} />
                  </View>
                </View>
                <TouchableOpacity style={styles.withdrawBtn} onPress={() => setShowModal(true)}>
                  <MaterialCommunityIcons name="wallet-plus" size={20} color="#fff" />
                  <Text style={styles.withdrawText}>Demander un retrait</Text>
                </TouchableOpacity>
                <View style={styles.withdrawNoteRow}>
                  <MaterialIcons name="info" size={14} color="#6B7280" />
                  <Text style={styles.withdrawNote}>
                    Veuillez contacter le service client après 24h sans reception de fonds
                  </Text>
                </View>
              </View>
            </View>
          </>
        ) : screenMode === "retrait" ? (
          <>
            <Animated.View style={[styles.retraitHeader, { transform: [{ translateY: retraitHeaderTranslate }] }]}>
              <Text style={styles.retraitHeaderTitle}>Historiques de rétrait</Text>
            </Animated.View>
            <Animated.View
              style={[
                styles.retraitPanel,
                { transform: [{ translateX: retraitTranslate }] },
              ]}
            >
              <View style={[styles.listCard, { height: retraitListHeight }]}>
                <Pressable
                  style={styles.filterRow}
                  onPress={() => {
                    setCalendarMonth(selectedDate ?? new Date());
                    setCalendarOpen(true);
                  }}
                >
                  <View style={styles.filterLeft}>
                    <MaterialIcons name="calendar-month" size={22} color="#1F6FEB" />
                    <Text style={styles.filterLabel}>{filterLabel}</Text>
                  </View>
                  <MaterialIcons name="keyboard-arrow-down" size={24} color="#111" />
                </Pressable>
                <View style={styles.divider} />
                <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
                  {retraitsFiltered.length === 0 ? (
                    <Text style={styles.emptyText}>Aucun retrait enregistré</Text>
                  ) : (
                    retraitsFiltered.map((item) => {
                      const color = getStatusColor(item.status);
                      return (
                        <View key={`retrait-${item.id}`} style={styles.itemCard}>
                          <View style={styles.itemLeft}>
                            <SvgXml xml={MONEY_SACK_SVG} width={28} height={28} />
                            <View style={styles.itemText}>
                              <Text style={styles.itemTitle}>Retrait</Text>
                              <Text style={styles.itemMeta}>
                                {new Date(item.created_at).toLocaleString("fr-FR", {
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </Text>
                              <Text style={[styles.itemStatus, { color }]}>
                                Statut : {item.status}
                              </Text>
                            </View>
                          </View>
                          <Text style={[styles.itemAmount, { color }]}>
                            {getAmountPrefix(item.status)}
                            {formatCurrency(item.amount)}
                          </Text>
                        </View>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            </Animated.View>
          </>
        ) : (
          <>
            <Animated.View style={[styles.retraitHeader, { transform: [{ translateY: retraitHeaderTranslate }] }]}>
              <Text style={styles.retraitHeaderTitle}>Historiques de gains</Text>
            </Animated.View>
            <Animated.View
              style={[
                styles.retraitPanel,
                { transform: [{ translateX: retraitTranslate }] },
              ]}
            >
              <View style={[styles.listCard, { height: retraitListHeight }]}>
                <Pressable
                  style={styles.filterRow}
                  onPress={() => {
                    setCalendarMonth(selectedDate ?? new Date());
                    setCalendarOpen(true);
                  }}
                >
                  <View style={styles.filterLeft}>
                    <MaterialIcons name="calendar-month" size={22} color="#1F6FEB" />
                    <Text style={styles.filterLabel}>{filterLabel}</Text>
                  </View>
                  <MaterialIcons name="keyboard-arrow-down" size={24} color="#111" />
                </Pressable>
                <View style={styles.divider} />
                <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
                  {gainsFiltered.length === 0 ? (
                    <Text style={styles.emptyText}>Aucun gain enregistré</Text>
                  ) : (
                    gainsFiltered.map((item) => {
                      const color = getStatusColor(item.status);
                      return (
                        <View key={`gain-${item.id}`} style={styles.itemCard}>
                          <View style={styles.itemLeft}>
                            <SvgXml xml={MONEY_SACK_SVG} width={28} height={28} />
                            <View style={styles.itemText}>
                              <Text style={styles.itemTitle}>Gain Mission</Text>
                              <Text style={styles.itemMeta}>
                                {new Date(item.created_at).toLocaleString("fr-FR", {
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}{" "}
                                - Mission #{item.request_id ?? item.id}
                              </Text>
                              <Text style={[styles.itemStatus, { color }]}>
                                Statut : {item.status}
                              </Text>
                            </View>
                          </View>
                          <Text style={[styles.itemAmount, { color }]}>
                            {getAmountPrefixGain()}
                            {formatCurrency(item.amount)}
                          </Text>
                        </View>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            </Animated.View>
          </>
        )}
      </ScrollView>

      <View pointerEvents="box-none" style={[styles.tabbarRoot, { paddingBottom: insets.bottom }]}>
        <View style={styles.bar}>
          <View style={styles.notchCut} />
          <View style={styles.ring} />

          <View style={styles.row}>
            <TouchableOpacity
              style={styles.item}
              activeOpacity={0.85}
              onPress={() => (screenMode === "historique" ? goWallet() : setScreenMode("historique"))}
            >
              <MaterialIcons name="history" size={26} color={screenMode === "historique" ? RED : "#111"} />
              <Text style={[styles.label, screenMode === "historique" && styles.labelOn]}>
                historique
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.centerSlot}
              activeOpacity={0.85}
              onPress={goWallet}
            >
              <MaterialCommunityIcons
                name="wallet"
                size={40}
                color="#fff"
                top={-40}
                style={screenMode !== "wallet" ? styles.centerIconDim : undefined}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.item}
              activeOpacity={0.85}
              onPress={() => setScreenMode("retrait")}
            >
              <MaterialIcons name="logout" size={26} color={screenMode === "retrait" ? RED : "#111"} />
              <Text style={[styles.label, screenMode === "retrait" && styles.labelOn]}>Retrait</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Calendrier filtre */}
      <Modal
        visible={calendarOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarOpen(false)}
      >
        <Pressable style={styles.calendarOverlay} onPress={() => setCalendarOpen(false)}>
          <Pressable style={styles.calendarCard} onPress={() => {}}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity
                style={styles.calendarNavBtn}
                onPress={() =>
                  setCalendarMonth(
                    new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)
                  )
                }
              >
                <MaterialIcons name="chevron-left" size={22} color="#111" />
              </TouchableOpacity>
              <Text style={styles.calendarTitle}>{monthLabel}</Text>
              <TouchableOpacity
                style={styles.calendarNavBtn}
                onPress={() =>
                  setCalendarMonth(
                    new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)
                  )
                }
              >
                <MaterialIcons name="chevron-right" size={22} color="#111" />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarWeekRow}>
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
                <Text key={d} style={styles.calendarWeekLabel}>
                  {d}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarDays.map((day, idx) => {
                if (!day) {
                  return <View key={`empty-${idx}`} style={styles.calendarDayEmpty} />;
                }
                const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
                const selected = selectedDate && isSameDay(date, selectedDate);
                const isToday = isSameDay(date, today);
                return (
                  <Pressable
                    key={`day-${day}`}
                    style={[
                      styles.calendarDay,
                      selected && styles.calendarDaySelected,
                      !selected && isToday && styles.calendarDayToday,
                    ]}
                    onPress={() => {
                      setSelectedDate(date);
                      setCalendarOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.calendarDayText,
                        selected && styles.calendarDayTextSelected,
                        !selected && isToday && styles.calendarDayTextToday,
                      ]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.calendarFooter}>
              <TouchableOpacity
                style={styles.calendarTodayBtn}
                onPress={() => {
                  setSelectedDate(null);
                  setCalendarOpen(false);
                }}
              >
                <Text style={styles.calendarTodayText}>Aujourd’hui</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal retrait */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlayCenter}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowModal(false)}
          >
            <View />
          </TouchableOpacity>
          <View style={styles.modalBox} pointerEvents="box-none">
            <Animated.View
              style={[
                styles.modalCard,
                { opacity: modalOpacity, transform: [{ scale: modalScale }] },
              ]}
            >
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setShowModal(false)}
                activeOpacity={0.8}
              >
                <MaterialIcons name="close" size={18} color="#E53935" />
              </TouchableOpacity>
              <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                <Text style={styles.modalTitle}> Demande de retrait</Text>

                {exceedsBalance && (
                  <Text style={styles.amountWarn}>
                    Montant supérieur au solde disponible
                  </Text>
                )}

                <TextInput
                  style={styles.input}
                  placeholder="Montant"
                placeholderTextColor="#888"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />

              <TextInput
                style={styles.input}
                placeholder="Numéro de téléphone"
                placeholderTextColor="#888"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />

              <Text style={styles.methodLabel}>
                Sélectionnez l’opérateur de retrait
              </Text>

              <View style={styles.methodsRow}>
                {["Orange Money", "Moov Money", "Wave"].map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.methodBtn,
                      method === m && styles.methodActive,
                    ]}
                    onPress={() => setMethod(m)}
                  >
                    <Text
                      style={
                        method === m
                          ? styles.methodTextActive
                          : styles.methodText
                      }
                    >
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setShowModal(false)}
                >
                  <Text style={styles.cancelBtnText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmBtn, exceedsBalance && styles.confirmBtnDisabled]}
                  onPress={confirmerRetrait}
                  disabled={exceedsBalance}
                >
                  <MaterialCommunityIcons name="check" size={18} color="#fff" />
                  <Text style={styles.confirmText}>Confirmer</Text>
                </TouchableOpacity>
              </View>
              </ScrollView>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scrollContent: { padding: 0, paddingBottom: 120 },
  bodyWrap: { paddingHorizontal: 16 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },

  heroCard: {
    backgroundColor: "#E53935",
    paddingVertical: 52,
    paddingHorizontal: 20,
    minHeight: 220,
    marginBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  heroShadow: {
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  heroTitle: { color: "#fff", fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 12 },
  heroCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  heroLabel: { color: "#FFECEC", fontSize: 13, fontWeight: "700" },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroAmountRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 8,
    marginTop: 6,
    marginBottom: 10,
  },
  heroAmount: { color: "#fff", fontSize: 30, fontWeight: "900" },
  heroCurrency: { color: "#fff", fontSize: 18, fontWeight: "800", marginTop: 6 },
  heroSub: { color: "#FFECEC", fontSize: 13, textAlign: "center", paddingTop: 10},

  statsCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  statsHeaderRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  statsHeader: { fontSize: 16, fontWeight: "800", color: "#111" },
  statsRow: { flexDirection: "row", gap: 12 },
  statBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F2F2F2",
    padding: 12,
    borderRadius: 12,
  },
  statIconWrap: {
    width: 30,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E8F7EC",
    alignItems: "center",
    justifyContent: "center",
  },
  statIconWrapBlue: {
    width: 30,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E6F0FF",
    alignItems: "center",
    justifyContent: "center",
  },
  statAmount: { fontSize: STAT_AMOUNT_SIZE, fontWeight: "800", color: "#16A34A", flexShrink: 1, maxWidth: "95%" },
  statAmountBlue: { fontSize: STAT_AMOUNT_SIZE, fontWeight: "800", color: "#1F6FEB", flexShrink: 1, maxWidth: "100%" },
  statSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },

  withdrawCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    marginBottom: 16,
  },
  withdrawHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  withdrawTextBlock: { flex: 1, paddingRight: 12 },
  withdrawTitle: { fontSize: 16, fontWeight: "800", color: "#111" },
  withdrawList: { marginTop: 6 },
  withdrawListRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  withdrawListItem: { fontSize: 12, color: "#111" },
  withdrawIllustration: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  hiddenBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eee",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  hiddenTitle: { fontSize: 16, fontWeight: "700", color: "#111", marginTop: 8 },
  hiddenSubtitle: { fontSize: 13, color: "#666", textAlign: "center", marginTop: 4 },
  withdrawBtn: {
    backgroundColor: "#E53935",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  withdrawText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  withdrawNoteRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  withdrawNote: { fontSize: 11, color: "#6B7280", flex: 1 },

  retraitHeader: {
    backgroundColor: RED,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    paddingTop: 60,
    paddingBottom: 26,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginBottom: 12,
  },
  retraitHeaderTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  retraitPanel: { paddingHorizontal: 16 },

  filterCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  filterLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  filterLabel: { fontSize: 16, fontWeight: "800", color: "#111" },
  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 8 },
  listCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  listContent: { paddingBottom: 8 },
  itemCard: {
    backgroundColor: "#F2F2F2",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  itemLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  itemText: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: "800", color: "#111" },
  itemMeta: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  itemStatus: { fontSize: 12, marginTop: 4 },
  itemAmount: { fontSize: 14, fontWeight: "800" },
  emptyText: { fontSize: 13, color: "#9CA3AF", paddingVertical: 6, textAlign: "center" },

  tabbarRoot: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 14,
  },
  bar: {
    height: 78,
    backgroundColor: "#fff",
    borderRadius: 28,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    overflow: "visible",
  },
  notchCut: {
    position: "absolute",
    top: -22,
    left: "50%",
    transform: [{ translateX: -44 }],
    width: 88,
    height: 44,
    borderRadius: 44,
    backgroundColor: BG,
  },
  ring: {
    position: "absolute",
    top: -40,
    left: "50%",
    transform: [{ translateX: -48 }],
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: RED,
    borderWidth: 4,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingBottom: 10,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111",
  },
  labelOn: {
    color: RED,
  },
  centerSlot: {
    width: 100,
    alignItems: "center",
    justifyContent: "center",
  },
 
  modalOverlayCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalBox: {
    width: "90%",
    alignItems: "center",
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  modalClose: {
    position: "absolute",
    right: 10,
    top: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FDECEC",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#E53935",
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    color: "#000",
  },
  methodLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "700",
    marginBottom: 8,
  },
  methodsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginBottom: 15,
  },
  methodBtn: {
    flexGrow: 1,
    minWidth: "28%",
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  methodActive: { backgroundColor: "#E53935", borderColor: "#E53935" },
  methodText: { color: "#333" },
  methodTextActive: { color: "#fff", fontWeight: "bold" },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelBtnText: { color: "#111", fontWeight: "800" },
  confirmBtn: {
    flex: 1,
    backgroundColor: "#E53935",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  confirmText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  confirmBtnDisabled: {
    backgroundColor: "#F3A1A0",
  },
  amountWarn: {
    color: "#E53935",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  calendarOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  calendarCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  calendarTitle: { fontSize: 16, fontWeight: "800", color: "#111", textTransform: "capitalize" },
  calendarNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  calendarWeekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  calendarWeekLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    width: "14.28%",
    textAlign: "center",
  },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  calendarDay: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    marginVertical: 4,
  },
  calendarDayEmpty: { width: "14.28%", aspectRatio: 1, marginVertical: 4 },
  calendarDayText: { fontSize: 13, fontWeight: "700", color: "#111" },
  calendarDaySelected: { backgroundColor: RED },
  calendarDayTextSelected: { color: "#fff" },
  calendarDayToday: { backgroundColor: "#FEE2E2" },
  calendarDayTextToday: { color: RED },
  calendarFooter: { marginTop: 6, alignItems: "flex-end" },
  calendarTodayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#FEE2E2",
  },
  calendarTodayText: { color: RED, fontWeight: "800", fontSize: 12 },
  centerIconDim: { opacity: 0.35 },
});
