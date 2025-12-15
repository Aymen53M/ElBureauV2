import React from 'react';
import type { IconType } from 'react-icons';
import {
    IoAddCircleOutline,
    IoArrowBack,
    IoContractOutline,
    IoCopyOutline,
    IoEyeOffOutline,
    IoEyeOutline,
    IoExpandOutline,
    IoFlash,
    IoGlobeOutline,
    IoHelpCircle,
    IoHelpCircleOutline,
    IoHome,
    IoKeyOutline,
    IoOpenOutline,
    IoPeople,
    IoPeopleOutline,
    IoPersonOutline,
    IoPlay,
    IoRefresh,
    IoSettingsOutline,
    IoTimer,
    IoTrophy,
    IoWarning,
    IoCheckmark,
    IoClose,
    IoCheckmarkCircle,
    IoCloseCircle,
    IoAlertCircle,
    IoArrowForward,
    IoFlashOff,
} from 'react-icons/io5';

const ICONS: Record<string, IconType> = {
    'add-circle-outline': IoAddCircleOutline,
    'arrow-back': IoArrowBack,
    'contract-outline': IoContractOutline,
    'copy-outline': IoCopyOutline,
    'eye-off-outline': IoEyeOffOutline,
    'eye-outline': IoEyeOutline,
    'expand-outline': IoExpandOutline,
    flash: IoFlash,
    'globe-outline': IoGlobeOutline,
    'help-circle': IoHelpCircle,
    'help-circle-outline': IoHelpCircleOutline,
    home: IoHome,
    'key-outline': IoKeyOutline,
    'open-outline': IoOpenOutline,
    people: IoPeople,
    'people-outline': IoPeopleOutline,
    'person-outline': IoPersonOutline,
    play: IoPlay,
    refresh: IoRefresh,
    'settings-outline': IoSettingsOutline,
    timer: IoTimer,
    trophy: IoTrophy,
    warning: IoWarning,
    checkmark: IoCheckmark,
    close: IoClose,
    'checkmark-circle': IoCheckmarkCircle,
    'close-circle': IoCloseCircle,
    'alert-circle': IoAlertCircle,
    'arrow-forward': IoArrowForward,
    'flash-off': IoFlashOff,
};

type IoniconsProps = {
    name: string;
    size?: number;
    color?: string;
    style?: any;
};

export function Ionicons({ name, size = 24, color = 'currentColor', style }: IoniconsProps) {
    const Icon = ICONS[name];
    if (!Icon) return null;
    return <Icon size={size} color={color} style={style} />;
}
