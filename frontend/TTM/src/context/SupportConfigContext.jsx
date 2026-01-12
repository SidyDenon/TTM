import React from "react";
import {
  buildServiceRequestMessage,
  buildWhatsAppLink,
  fetchSupportConfig,
} from "../config/links";

const DEFAULT_SUPPORT = {
  phone: "+22373585046",
  whatsapp: "0022373585046",
  email: "support@ttm.com",
};

const SupportConfigContext = React.createContext({
  support: DEFAULT_SUPPORT,
  buildSupportWhatsAppLink: (message) =>
    buildWhatsAppLink(message, DEFAULT_SUPPORT.whatsapp),
  buildSupportServiceLink: (service) =>
    buildWhatsAppLink(buildServiceRequestMessage(service), DEFAULT_SUPPORT.whatsapp),
});

export function SupportConfigProvider({ children }) {
  const [support, setSupport] = React.useState(DEFAULT_SUPPORT);

  React.useEffect(() => {
    let active = true;
    fetchSupportConfig().then((cfg) => {
      if (!active) return;
      setSupport({
        phone: cfg.phone || DEFAULT_SUPPORT.phone,
        whatsapp: cfg.whatsapp || DEFAULT_SUPPORT.whatsapp,
        email: cfg.email || DEFAULT_SUPPORT.email,
      });
    });
    return () => {
      active = false;
    };
  }, []);

  const buildSupportWhatsAppLink = React.useCallback(
    (message) => buildWhatsAppLink(message, support.whatsapp),
    [support.whatsapp],
  );

  const buildSupportServiceLink = React.useCallback(
    (service) => buildWhatsAppLink(buildServiceRequestMessage(service), support.whatsapp),
    [support.whatsapp],
  );

  return (
    <SupportConfigContext.Provider
      value={{ support, buildSupportWhatsAppLink, buildSupportServiceLink }}
    >
      {children}
    </SupportConfigContext.Provider>
  );
}

export function useSupportConfig() {
  return React.useContext(SupportConfigContext);
}
