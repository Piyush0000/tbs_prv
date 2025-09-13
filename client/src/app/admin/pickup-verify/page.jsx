"use client";
import QRScanner from "../../../components/QRScanner"; // Your first QRScanner
export default function PickupVerifyPage() {
  const handleScanComplete = (data) => {
    // Handle successful pickup verification
    console.log("Pickup verified:", data);
  };
  
  return <QRScanner onScanned={handleScanComplete} />;
}