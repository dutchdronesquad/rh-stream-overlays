#!/bin/bash

# Function to download and extract a zip file
download_and_extract() {
    local url=$1
    local temp_zip=~/temp.zip

    echo "Downloading from $url..."
    wget $url -O $temp_zip
    if [ $? -ne 0 ]; then
        echo "Error: Failed to download the project."
        exit 1
    fi

    echo "Extracting the downloaded zip file..."
    unzip -q $temp_zip -d ~
    if [ $? -ne 0 ]; then
        echo "Error: Failed to unzip the files."
        rm $temp_zip
        exit 1
    fi

    local folder_name=$(unzip -Z1 $temp_zip | head -1 | cut -d'/' -f1)
    if [ -z "$folder_name" ]; then
        echo "Error: Unable to determine the folder name from the zip file."
        rm $temp_zip
        exit 1
    fi

    local target_dir=~/RotorHazard/src/server/plugins
    echo "Moving the files to $target_dir"
    mv ~/$folder_name/stream_overlays $target_dir
    if [ $? -ne 0 ]; then
        echo "Error: Failed to move the plugin directory."
        rm -R ~/$folder_name
        rm $temp_zip
        exit 1
    fi

    echo "Cleaning up temporary files"
    rm -R ~/$folder_name
    rm $temp_zip

    echo "Installation/update completed successfully!"
}

# Function to install/update the plugin to the latest stable release
install_or_update_plugin() {
    echo "Fetching the latest stable release version..."
    local repo="dutchdronesquad/rh-stream-overlays"
    local latest_release=$(curl -s "https://api.github.com/repos/$repo/releases/latest" | grep "tag_name" | cut -d '"' -f 4)

    if [ -z "$latest_release" ]; then
        echo "Error: Unable to fetch the latest release version."
        exit 1
    fi

    echo "Latest release version is $latest_release."
    local download_url="https://codeload.github.com/$repo/zip/refs/tags/$latest_release"
    download_and_extract $download_url
}

# Function to install/update the plugin to the development version
install_development_plugin() {
    local repo="dutchdronesquad/rh-stream-overlays"
    local download_url="https://codeload.github.com/$repo/zip/refs/heads/main"
    download_and_extract $download_url
}

# Function to display a menu and get user choice
display_menu() {
    echo "-------------------------------------------"
    echo " DDS Stream Overlays Plugin Installer "
    echo "-------------------------------------------"
    echo "Please select an option:"
    echo "1) Install the stable release"
    echo "2) Install the development version"
    echo "3) Cancel"
    echo "-------------------------------------------"
    read -p "Enter your choice [1-3]: " menu_choice
    echo "-------------------------------------------"
}

# Ask the user if they want to install/update the plugin
display_menu
case "$menu_choice" in 
    1 ) 
        # Check if the plugin directory already exists
        plugin_dir=~/RotorHazard/src/server/plugins/stream_overlays
        if [ -d "$plugin_dir" ]; then
            echo "The plugin already exists in RotorHazard."
            read -p "Do you want to update it? (y/n): " update_choice
            case "$update_choice" in 
                y|Y ) 
                    echo "Removing the existing plugin directory..."
                    rm -rf $plugin_dir
                    install_or_update_plugin;;
                n|N ) 
                    echo "Update cancelled.";;
                * ) 
                    echo "Invalid choice. Update cancelled.";;
            esac
        else
            install_or_update_plugin
        fi
        ;;
    2 )
        # Check if the plugin directory already exists
        plugin_dir=~/RotorHazard/src/server/plugins/stream_overlays
        if [ -d "$plugin_dir" ]; then
            echo "The plugin already exists in RotorHazard."
            read -p "Do you want to update it? (y/n): " update_choice
            case "$update_choice" in 
                y|Y ) 
                    echo "Removing the existing plugin directory..."
                    rm -rf $plugin_dir
                    install_development_plugin;;
                n|N ) 
                    echo "Update cancelled.";;
                * ) 
                    echo "Invalid choice. Update cancelled.";;
            esac
        else
            install_development_plugin
        fi
        ;;
    3 ) 
        echo "Installation cancelled.";;
    * ) 
        echo "Invalid choice. Installation/update cancelled.";;
esac