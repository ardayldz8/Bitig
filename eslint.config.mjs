import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/*
 * Next 16'da eslint-config-next zaten flat config veriyor.
 *
 * Önce @eslint/eslintrc'nin FlatCompat'ı üzerinden yükleniyordu; 16 ile
 * birlikte bu katman "property 'react' closes the circle" hatasıyla
 * patlıyor — flat bir yapılandırmayı eskisi sanıp normalleştirmeye
 * çalışıyor. Doğrudan import etmek hem çalışıyor hem bir bağımlılık eksiltiyor.
 */
const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "out/**", "next-env.d.ts"] },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      /*
       * Next 16 ile gelen yeni kural. Uygulamanın veri katmanı baştan sona
       * "effect içinde yükle → setState" ve "context'ten durum türet"
       * deseni üzerine kurulu (use-cloud-collection, use-projects,
       * use-dashboard-data, use-github-installation…).
       *
       * KAPATILMADI, uyarıya indirildi: 14 çağrı yerini Suspense/use()'a
       * taşımak veri katmanının tamamını yeniden yazmak demek — işlevsel
       * kazanç yok, gerileme riski gerçek. Uyarı olarak kalması, ileride
       * bir veri kütüphanesine geçilirse borcun görünür olmasını sağlıyor.
       *
       * Bu kuralın işaret ettiği GERÇEK hatalar ayrıca düzeltildi:
       * auth-provider render sırasında ref okuyordu ve client atandığında
       * hiçbir state değişmediği için tüketiciler bir süre `null` görüyordu.
       */
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default eslintConfig;
