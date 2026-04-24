use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DestroyWindow, GetClientRect, SetParent,
    WS_POPUP, WS_VISIBLE, WS_CHILD, WS_EX_LAYERED, WS_EX_TRANSPARENT,
    CW_USEDEFAULT,
};
use windows::core::PCWSTR;
use std::ptr;

pub struct PlayerWindow {
    hwnd: HWND,
    parent_hwnd: HWND,
}

impl PlayerWindow {
    pub fn new(parent_hwnd: isize) -> Result<Self, String> {
        let parent = HWND(parent_hwnd);
        
        // Crea finestra child per il video (come fa Stremio)
        let class_name = PCWSTR::from_raw(L"player_container\0".as_ptr());
        
        let hwnd = unsafe {
            CreateWindowExW(
                WS_EX_LAYERED | WS_EX_TRANSPARENT,
                class_name,
                PCWSTR::null(),
                WS_POPUP | WS_VISIBLE | WS_CHILD,
                CW_USEDEFAULT,
                CW_USEDEFAULT,
                CW_USEDEFAULT,
                CW_USEDEFAULT,
                Some(parent),
                None,
                None,
                None,
            )
        };
        
        if hwnd.0 == 0 {
            return Err("Impossibile creare finestra container".to_string());
        }
        
        Ok(Self {
            hwnd,
            parent_hwnd: parent,
        })
    }
    
    pub fn get_hwnd(&self) -> isize {
        self.hwnd.0 as isize
    }
    
    pub fn resize(&self, width: u32, height: u32) -> Result<(), String> {
        use windows::Win32::UI::WindowsAndMessaging::MoveWindow;
        
        let result = unsafe {
            MoveWindow(self.hwnd, 0, 0, width as i32, height as i32, true)
        };
        
        if result.as_bool() {
            Ok(())
        } else {
            Err("Impossibile ridimensionare finestra".to_string())
        }
    }
}

impl Drop for PlayerWindow {
    fn drop(&mut self) {
        unsafe {
            let _ = DestroyWindow(self.hwnd);
        }
    }
}