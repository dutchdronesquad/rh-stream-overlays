#!/bin/bash

# Function to download and install/update the plugin
install_or_update_plugin() {
    echo "Fetching the latest stable release version..."
    REPO="dutchdronesquad/rh-stream-overlays"
    LATEST_RELEASE=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" | grep "tag_name" | cut -d '"' -f 4)
    
    if [ -z "$LATEST_RELEASE" ]; then
        echo "Error: Unable to fetch the latest release version."
        exit 1
    fi

    echo "Latest release version is $LATEST_RELEASE. Downloading..."
    DOWNLOAD_URL="https://codeload.github.com/$REPO/zip/refs/tags/$LATEST_RELEASE"
    TEMP_ZIP=~/temp.zip
    echo ""

    wget $DOWNLOAD_URL -O $TEMP_ZIP
    if [ $? -ne 0 ]; then
        echo "Error: Failed to download the release."
        exit 1
    fi

    echo "Extracting the downloaded zip file..."
    unzip -q $TEMP_ZIP -d ~
    if [ $? -ne 0 ]; then
        echo "Error: Failed to unzip the file."
        rm $TEMP_ZIP
        exit 1
    fi

    FOLDER_NAME=$(unzip -Z1 $TEMP_ZIP | head -1 | cut -d'/' -f1)
    if [ -z "$FOLDER_NAME" ]; then
        echo "Error: Unable to determine the folder name from the zip file."
        rm $TEMP_ZIP
        exit 1
    fi

    TARGET_DIR=~/RotorHazard/src/server/plugins
    echo "Moving the files to $TARGET_DIR"
    mv ~/$FOLDER_NAME/stream_overlays $TARGET_DIR
    if [ $? -ne 0 ]; then
        echo "Error: Failed to move the plugin directory."
        rm -R ~/$FOLDER_NAME
        rm $TEMP_ZIP
        exit 1
    fi

    echo "Cleaning up temporary files"
    rm -R ~/$FOLDER_NAME
    rm $TEMP_ZIP

    echo "Update to version $LATEST_RELEASE completed successfully!"
}

# Ask the user if they want to install/update the plugin
read -p "Do you want to install the stream overlays plugin? (y/n): " choice
case "$choice" in 
    y|Y ) 
        # Check if the plugin directory already exists
        PLUGIN_DIR=~/RotorHazard/src/server/plugins/stream_overlays
        if [ -d "$PLUGIN_DIR" ]; then
            read -p "The plugin already exists in RotorHazard. Do you want to update it? (y/n): " update_choice
            case "$update_choice" in 
                y|Y ) 
                    # Remove existing directory
                    echo "Removing the existing plugin directory..."
                    rm -rf $PLUGIN_DIR
                    install_or_update_plugin;;
                n|N ) echo "Update cancelled.";;
                * ) echo "Invalid choice. Update cancelled.";;
            esac
        else
            install_or_update_plugin
        fi
        ;;
    n|N ) echo "Installation cancelled.";;
    * ) echo "Invalid choice. Installation/update cancelled.";;
esac